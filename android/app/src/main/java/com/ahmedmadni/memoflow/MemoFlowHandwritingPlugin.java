package com.ahmedmadni.memoflow;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.common.model.DownloadConditions;
import com.google.mlkit.common.model.RemoteModelManager;
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognition;
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognitionModel;
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognitionModelIdentifier;
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognizer;
import com.google.mlkit.vision.digitalink.recognition.DigitalInkRecognizerOptions;
import com.google.mlkit.vision.digitalink.recognition.Ink;
import com.google.mlkit.vision.digitalink.recognition.RecognitionContext;
import com.google.mlkit.vision.digitalink.recognition.WritingArea;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.concurrent.atomic.AtomicLong;

/** Local Arabic digital ink, explicitly downloaded and reviewed by the user.
 * No note text, strokes or recognition output is logged or persisted here. */
@CapacitorPlugin(name = "MemoFlowHandwriting")
public final class MemoFlowHandwritingPlugin extends Plugin {
    private final AtomicLong generation = new AtomicLong();
    private volatile PluginCall activeCall;
    private DigitalInkRecognizer client;
    private volatile boolean downloading;

    private DigitalInkRecognitionModel model() throws Exception {
        DigitalInkRecognitionModelIdentifier id = DigitalInkRecognitionModelIdentifier.fromLanguageTag("ar");
        if (id == null) throw new IllegalStateException("نموذج العربية غير متاح.");
        return DigitalInkRecognitionModel.builder(id).build();
    }
    @PluginMethod
    public void getStatus(PluginCall call) {
        try {
            RemoteModelManager.getInstance().isModelDownloaded(model())
                .addOnSuccessListener(ready -> {
                    JSObject status = new JSObject();
                    status.put("supported", true); status.put("ready", ready);
                    status.put("language", "ar"); status.put("experimental", true);
                    call.resolve(status);
                }).addOnFailureListener(error -> call.reject("تعذر فحص نموذج الكتابة.", "MODEL_STATUS"));
        } catch (Exception error) { call.reject("نموذج العربية غير متاح.", "MODEL_UNAVAILABLE"); }
    }
    @PluginMethod
    public void downloadModel(PluginCall call) {
        if (!MemoFlowAppLockPlugin.isSessionUnlocked()) { call.reject("افتح التطبيق أولًا.", "LOCKED"); return; }
        if (downloading) { call.reject("تنزيل النموذج جارٍ بالفعل.", "BUSY"); return; }
        downloading = true;
        try {
            RemoteModelManager.getInstance().download(model(), new DownloadConditions.Builder().build())
                .addOnSuccessListener(unused -> { downloading = false; call.resolve(); })
                .addOnFailureListener(error -> { downloading = false; call.reject("تعذر تنزيل نموذج العربية. تحقق من الإنترنت والمساحة وأعد المحاولة.", "MODEL_DOWNLOAD"); });
        } catch (Exception error) { downloading = false; call.reject("نموذج العربية غير متاح.", "MODEL_UNAVAILABLE"); }
    }
    @PluginMethod
    public void deleteModel(PluginCall call) {
        if (!MemoFlowAppLockPlugin.isSessionUnlocked()) { call.reject("افتح التطبيق أولًا.", "LOCKED"); return; }
        if (downloading || activeCall != null) { call.reject("انتظر انتهاء العملية الحالية.", "BUSY"); return; }
        try {
            RemoteModelManager.getInstance().deleteDownloadedModel(model())
                .addOnSuccessListener(unused -> call.resolve())
                .addOnFailureListener(error -> call.reject("تعذر إزالة نموذج العربية.", "MODEL_DELETE"));
        } catch (Exception error) { call.reject("تعذر إزالة نموذج العربية.", "MODEL_DELETE"); }
    }
    @PluginMethod
    public synchronized void recognize(PluginCall call) {
        if (!MemoFlowAppLockPlugin.isSessionUnlocked()) { call.reject("افتح التطبيق أولًا.", "LOCKED"); return; }
        if (activeCall != null) { call.reject("عملية التعرف الحالية لم تنته.", "BUSY"); return; }
        try {
            JSArray input = call.getArray("strokes");
            if (input == null || input.length() > 100) throw new IllegalArgumentException("حدد جزءًا أصغر من الكتابة.");
            double[][][] points = new double[input.length()][][];
            long[][] times = new long[input.length()][];
            int totalSamples = 0;
            for (int s = 0; s < input.length(); s++) {
                JSONObject stroke = input.getJSONObject(s);
                JSONArray samples = stroke.getJSONArray("points");
                if (samples.length() > 4000) throw new IllegalArgumentException("مسار الكتابة كبير جدًا.");
                totalSamples += samples.length();
                if (totalSamples > 30000) throw new IllegalArgumentException("حدد جزءًا أصغر من الكتابة.");
                points[s] = new double[samples.length()][2];
                for (int p = 0; p < samples.length(); p++) {
                    JSONArray xy = samples.getJSONArray(p);
                    if (xy.length() != 2) throw new IllegalArgumentException("إحداثيات الكتابة غير صالحة.");
                    points[s][p][0] = xy.getDouble(0); points[s][p][1] = xy.getDouble(1);
                }
                JSONArray captured = stroke.optJSONArray("times");
                if (captured != null) {
                    if (captured.length() != samples.length()) throw new IllegalArgumentException("عينات وقت الكتابة غير متطابقة.");
                    times[s] = new long[captured.length()];
                    for (int p = 0; p < captured.length(); p++) {
                        double time = captured.getDouble(p);
                        if (!Double.isFinite(time) || time != Math.floor(time) || time < 0 || time > 9007199254740991d)
                            throw new IllegalArgumentException("وقت الكتابة غير صالح.");
                        times[s][p] = (long) time;
                    }
                }
            }
            double aspect = call.getDouble("aspect", 1d);
            double lineHeight = call.getDouble("lineHeight", 50d);
            HandwritingInput.validate(points, times, aspect, lineHeight);
            double minX = 1000, minY = 1000, maxX = 0;
            for (double[][] stroke : points) for (double[] xy : stroke) {
                minX = Math.min(minX, xy[0]); minY = Math.min(minY, xy[1]); maxX = Math.max(maxX, xy[0]);
            }
            Ink.Builder ink = Ink.builder();
            for (int s = 0; s < points.length; s++) {
                Ink.Stroke.Builder stroke = Ink.Stroke.builder();
                for (int p = 0; p < points[s].length; p++) {
                    float x = (float) (points[s][p][0] - minX), y = (float) ((points[s][p][1] - minY) * aspect);
                    stroke.addPoint(times[s] == null ? Ink.Point.create(x, y) : Ink.Point.create(x, y, times[s][p]));
                }
                ink.addStroke(stroke.build());
            }
            RecognitionContext context = RecognitionContext.builder()
                .setWritingArea(new WritingArea((float) Math.max(1, maxX - minX), (float) lineHeight)).build();
            DigitalInkRecognitionModel arabic = model();
            long token = generation.get(), lockEpoch = MemoFlowAppLockPlugin.captureSessionEpoch();
            activeCall = call;
            RemoteModelManager.getInstance().isModelDownloaded(arabic).addOnSuccessListener(ready -> {
                if (!current(call, token, lockEpoch)) return;
                if (!ready) { call.reject("نزّل نموذج العربية أولًا.", "MODEL_NOT_DOWNLOADED"); finish(call); return; }
                try {
                final DigitalInkRecognizer recognizer = DigitalInkRecognition.getClient(DigitalInkRecognizerOptions.builder(arabic).build());
                synchronized (this) {
                    if (!current(call, token, lockEpoch)) { recognizer.close(); return; }
                    client = recognizer;
                }
                recognizer.recognize(ink.build(), context).addOnSuccessListener(result -> {
                    if (!current(call, token, lockEpoch)) return;
                    JSArray candidates = new JSArray();
                    for (int i = 0; i < Math.min(5, result.getCandidates().size()); i++) {
                        String text = result.getCandidates().get(i).getText();
                        if (text != null && !text.trim().isEmpty() && text.length() <= 5000) candidates.put(text);
                    }
                    JSObject response = new JSObject(); response.put("candidates", candidates); response.put("language", "ar");
                    call.resolve(response); finish(call);
                }).addOnFailureListener(error -> {
                    if (current(call, token, lockEpoch)) { call.reject("تعذر التعرف على هذا الجزء. حدد سطرًا أصغر وأعد المحاولة.", "RECOGNITION_FAILED"); finish(call); }
                });
                } catch (Exception error) {
                    if (current(call, token, lockEpoch)) { call.reject("تعذر تشغيل محرك التعرف.", "RECOGNITION_FAILED"); finish(call); }
                }
            }).addOnFailureListener(error -> {
                if (current(call, token, lockEpoch)) { call.reject("تعذر فحص نموذج العربية.", "MODEL_STATUS"); finish(call); }
            });
        } catch (Exception error) {
            call.reject(error instanceof IllegalArgumentException ? error.getMessage() : "بيانات الكتابة غير صالحة.", "INVALID_INK");
            finish(call);
        }
    }
    private synchronized boolean current(PluginCall call, long token, long lockEpoch) {
        if (activeCall != call) return false;
        if (generation.get() == token && MemoFlowAppLockPlugin.isSessionUnlocked() &&
                MemoFlowAppLockPlugin.captureSessionEpoch() == lockEpoch) return true;
        call.reject("ألغيت العملية عند قفل التطبيق.", "CANCELLED"); finish(call); return false;
    }
    private synchronized void finish(PluginCall call) {
        if (activeCall != call) return;
        activeCall = null;
        if (client != null) { client.close(); client = null; }
    }
    private synchronized void cancelPending() {
        generation.incrementAndGet();
        if (activeCall != null) { PluginCall old = activeCall; old.reject("ألغيت عملية التعرف.", "CANCELLED"); finish(old); }
    }
    @PluginMethod public void cancel(PluginCall call) { cancelPending(); call.resolve(); }
    @Override protected void handleOnPause() { cancelPending(); }
    @Override protected void handleOnDestroy() { cancelPending(); }
}
