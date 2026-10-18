package com.ahmedmadni.memoflow;

import android.annotation.SuppressLint;
import android.app.Service;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.IBinder;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.util.ArrayList;

/** Draggable floating reminder card. Tap the title to open MemoFlow, ✕ to close. */
public class FloatingCardService extends Service {
    private WindowManager wm;
    private View card;

    @Override public IBinder onBind(Intent intent) { return null; }

    // ACTION_UP calls performClick explicitly; lint cannot infer that through the drag branch.
    @SuppressLint("ClickableViewAccessibility")
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
        head.setGravity(Gravity.CENTER_VERTICAL);
        TextView title = new TextView(this);
        title.setText(R.string.floating_card_title);
        title.setTextColor(0xFF111111);
        title.setTextSize(14);
        title.setLayoutParams(new LinearLayout.LayoutParams(0, -2, 1f));
        title.setOnClickListener(v -> {
            Intent open = new Intent(this, MainActivity.class);
            open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(open);
        });
        TextView close = new TextView(this);
        close.setText(R.string.floating_card_close);
        close.setTextSize(16);
        close.setTextColor(0xFF555555);
        close.setPadding((int) (8 * d), 0, 0, 0);
        close.setOnClickListener(v -> stopSelf());
        head.addView(title);
        head.addView(close);
        box.addView(head);

        if (lines.isEmpty()) lines.add(getString(R.string.floating_card_empty));
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

        final int cardWidth = (int) (240 * d);
        final int touchSlop = ViewConfiguration.get(this).getScaledTouchSlop();
        title.setOnTouchListener(new View.OnTouchListener() {
            int sx, sy;
            float tx, ty;
            boolean moved;

            @Override public boolean onTouch(View v, MotionEvent e) {
                switch (e.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        sx = lp.x;
                        sy = lp.y;
                        tx = e.getRawX();
                        ty = e.getRawY();
                        moved = false;
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        int dx = (int) (e.getRawX() - tx);
                        int dy = (int) (e.getRawY() - ty);
                        if (Math.abs(dx) > touchSlop || Math.abs(dy) > touchSlop) moved = true;
                        int maxX = Math.max(0, getResources().getDisplayMetrics().widthPixels - cardWidth);
                        int maxY = Math.max(0, getResources().getDisplayMetrics().heightPixels - (int) (72 * d));
                        lp.x = Math.max(0, Math.min(maxX, sx + dx));
                        lp.y = Math.max(0, Math.min(maxY, sy + dy));
                        try { wm.updateViewLayout(box, lp); } catch (Exception ignored) { }
                        return true;
                    case MotionEvent.ACTION_UP:
                        if (!moved) v.performClick();
                        return true;
                    case MotionEvent.ACTION_CANCEL:
                        return true;
                }
                return false;
            }
        });
        card = box;
        try {
            wm.addView(card, lp);
        } catch (SecurityException | WindowManager.BadTokenException denied) {
            card = null;
            stopSelf();
        }
        return START_NOT_STICKY;
    }

    private void removeCard() {
        if (card != null && wm != null) { try { wm.removeView(card); } catch (Exception ignored) { } }
        card = null;
    }

    @Override public void onDestroy() { removeCard(); super.onDestroy(); }
}
