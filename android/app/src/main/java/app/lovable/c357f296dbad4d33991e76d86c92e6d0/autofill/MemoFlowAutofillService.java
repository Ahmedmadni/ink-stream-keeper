package app.lovable.c357f296dbad4d33991e76d86c92e6d0.autofill;

import android.app.PendingIntent;
import android.app.assist.AssistStructure;
import android.content.Intent;
import android.os.CancellationSignal;
import android.service.autofill.AutofillService;
import android.service.autofill.Dataset;
import android.service.autofill.FillCallback;
import android.service.autofill.FillContext;
import android.service.autofill.FillRequest;
import android.service.autofill.FillResponse;
import android.service.autofill.SaveCallback;
import android.service.autofill.SaveInfo;
import android.service.autofill.SaveRequest;
import android.view.autofill.AutofillId;
import android.view.autofill.AutofillManager;
import android.view.autofill.AutofillValue;
import android.widget.RemoteViews;

import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;

import java.util.List;

@RequiresApi(26)
public final class MemoFlowAutofillService extends AutofillService {
    private final AutofillFormParser parser = new AutofillFormParser();

    @Override
    public void onFillRequest(
            @NonNull FillRequest request,
            @NonNull CancellationSignal cancellationSignal,
            @NonNull FillCallback callback) {
        try {
            if (request.getFillContexts().isEmpty() || cancellationSignal.isCanceled()) {
                callback.onSuccess(null);
                return;
            }
            AssistStructure structure = lastStructure(request.getFillContexts());
            AutofillFormParser.ParsedForm form = parser.parse(structure);
            if (form.passwordId == null || getPackageName().equals(form.packageName)) {
                callback.onSuccess(null);
                return;
            }

            EncryptedCredentialStore store = new EncryptedCredentialStore(this);
            List<MemoFlowCredential> matches = store.matches(form.packageName, form.webDomain);
            FillResponse.Builder response = new FillResponse.Builder().setSaveInfo(saveInfo(form));
            if (!matches.isEmpty()) {
                Intent authentication = new Intent(this, MemoFlowAutofillAuthActivity.class);
                authentication.putExtra(AutofillManager.EXTRA_ASSIST_STRUCTURE, structure);
                PendingIntent pendingIntent = PendingIntent.getActivity(
                        this,
                        (form.packageName + form.webDomain).hashCode(),
                        authentication,
                        PendingIntent.FLAG_CANCEL_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                RemoteViews presentation = presentation("فتح MemoFlow للملء التلقائي");
                response.setAuthentication(form.ids(), pendingIntent.getIntentSender(), presentation);
            }
            callback.onSuccess(response.build());
        } catch (Exception error) {
            callback.onFailure("تعذر فتح بيانات MemoFlow المشفرة");
        }
    }

    @Override
    public void onSaveRequest(@NonNull SaveRequest request, @NonNull SaveCallback callback) {
        try {
            if (request.getFillContexts().isEmpty()) {
                callback.onFailure("لا توجد بيانات دخول للحفظ");
                return;
            }
            AutofillFormParser.ParsedForm form = parser.parse(lastStructure(request.getFillContexts()));
            if (form.passwordValue.isEmpty() || getPackageName().equals(form.packageName)) {
                callback.onFailure("كلمة المرور فارغة");
                return;
            }
            String label = !form.webDomain.isEmpty() ? form.webDomain : form.packageName;
            new EncryptedCredentialStore(this).saveCaptured(
                    label,
                    form.usernameValue,
                    form.passwordValue,
                    form.packageName,
                    form.webDomain);
            callback.onSuccess();
        } catch (Exception error) {
            callback.onFailure("تعذر حفظ بيانات الدخول في MemoFlow");
        }
    }

    static FillResponse authenticatedResponse(
            android.content.Context context,
            AutofillFormParser.ParsedForm form,
            List<MemoFlowCredential> credentials) {
        FillResponse.Builder response = new FillResponse.Builder().setSaveInfo(saveInfo(form));
        for (MemoFlowCredential credential : credentials) {
            Dataset.Builder dataset = new Dataset.Builder();
            RemoteViews item = presentation(context, credential.presentationLabel());
            if (form.usernameId != null && !credential.username.isEmpty()) {
                dataset.setValue(form.usernameId, AutofillValue.forText(credential.username), item);
            }
            dataset.setValue(form.passwordId, AutofillValue.forText(credential.password), item);
            response.addDataset(dataset.build());
        }
        return response.build();
    }

    private static SaveInfo saveInfo(AutofillFormParser.ParsedForm form) {
        int types = SaveInfo.SAVE_DATA_TYPE_PASSWORD;
        AutofillId[] required;
        if (form.usernameId != null) {
            types |= SaveInfo.SAVE_DATA_TYPE_USERNAME;
            required = new AutofillId[]{form.usernameId, form.passwordId};
        } else {
            required = new AutofillId[]{form.passwordId};
        }
        return new SaveInfo.Builder(types, required)
                .setDescription("حفظ بيانات الدخول في MemoFlow")
                .build();
    }

    private static AssistStructure lastStructure(List<FillContext> contexts) {
        return contexts.get(contexts.size() - 1).getStructure();
    }

    private RemoteViews presentation(String label) {
        return presentation(this, label);
    }

    private static RemoteViews presentation(android.content.Context context, String label) {
        RemoteViews views = new RemoteViews(context.getPackageName(), android.R.layout.simple_list_item_1);
        views.setTextViewText(android.R.id.text1, label);
        return views;
    }
}
