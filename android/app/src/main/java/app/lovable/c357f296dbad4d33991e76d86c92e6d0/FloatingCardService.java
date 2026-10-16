package app.lovable.c357f296dbad4d33991e76d86c92e6d0;

import android.app.Service;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.IBinder;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.ArrayList;

/** Draggable floating reminder card. Tap the title to open MemoFlow, ✕ to close. */
public class FloatingCardService extends Service {
    private WindowManager wm;
    private View card;

    @Override public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        ArrayList<String> lines = intent != null ? intent.getStringArrayListExtra("lines") : null;
        if (lines == null) lines = new ArrayList<>();
        removeCard();
        wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        float d = getResources().getDisplayMetrics().density;

        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding((int) (14 * d), (int) (12 * d), (int) (14 * d), (int) (12 * d));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(0xEEFFFFFF);
        bg.setCornerRadius(20 * d);
        bg.setStroke((int) d, 0x22000000);
        box.setBackground(bg);
        box.setElevation(12 * d);

        LinearLayout head = new LinearLayout(this);
        TextView title = new TextView(this);
        title.setText("MemoFlow • تذكير");
        title.setTextColor(0xFF111111);
        title.setTextSize(14);
        title.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1f));
        title.setOnClickListener(v -> {
            Intent open = new Intent(this, MainActivity.class);
            open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(open);
        });
        TextView close = new TextView(this);
        close.setText("✕");
        close.setTextSize(16);
        close.setTextColor(0xFF555555);
        close.setPadding((int) (8 * d), 0, 0, 0);
        close.setOnClickListener(v -> stopSelf());
        head.addView(title);
        head.addView(close);
        box.addView(head);

        if (lines.isEmpty()) lines.add("لا توجد عناصر حالياً");
        for (String s : lines) {
            TextView t = new TextView(this);
            t.setText(s);
            t.setTextColor(0xFF333333);
            t.setTextSize(13);
            t.setPadding(0, (int) (6 * d), 0, 0);
            t.setMaxLines(1);
            box.addView(t);
        }

        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;
        WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
                (int) (240 * d), -2, type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT);
        lp.gravity = Gravity.TOP | Gravity.START;
        lp.x = (int) (16 * d);
        lp.y = (int) (120 * d);

        box.setOnTouchListener(new View.OnTouchListener() {
            int sx, sy; float tx, ty;
            @Override public boolean onTouch(View v, MotionEvent e) {
                switch (e.getAction()) {
                    case MotionEvent.ACTION_DOWN: sx = lp.x; sy = lp.y; tx = e.getRawX(); ty = e.getRawY(); return false;
                    case MotionEvent.ACTION_MOVE:
                        lp.x = sx + (int) (e.getRawX() - tx);
                        lp.y = sy + (int) (e.getRawY() - ty);
                        wm.updateViewLayout(box, lp);
                        return true;
                }
                return false;
            }
        });
        card = box;
        wm.addView(card, lp);
        return START_NOT_STICKY;
    }

    private void removeCard() {
        if (card != null && wm != null) { try { wm.removeView(card); } catch (Exception ignored) { } }
        card = null;
    }

    @Override public void onDestroy() { removeCard(); super.onDestroy(); }
}
