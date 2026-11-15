package com.ahmedmadni.memoflow;

/** Pure validation, independent of Android/ML Kit. Never synthesize capture times. */
final class HandwritingInput {
    static void validate(double[][][] strokes, long[][] times, double aspect, double lineHeight) {
        if (!Double.isFinite(aspect) || aspect < .25 || aspect > 4 ||
                !Double.isFinite(lineHeight) || lineHeight < 1 || lineHeight > 4000)
            throw new IllegalArgumentException("أبعاد منطقة الكتابة غير صالحة.");
        if (strokes == null || strokes.length == 0 || strokes.length > 100)
            throw new IllegalArgumentException("حدد من مسار واحد إلى 100 مسار للتعرف.");
        if (times != null && times.length != strokes.length)
            throw new IllegalArgumentException("عينات وقت الكتابة غير متطابقة.");
        int count = 0;
        for (int s = 0; s < strokes.length; s++) {
            if (strokes[s] == null || strokes[s].length == 0 || strokes[s].length > 4000)
                throw new IllegalArgumentException("مسار الكتابة فارغ أو كبير جدًا.");
            count += strokes[s].length;
            if (count > 30000) throw new IllegalArgumentException("حدد جزءًا أصغر من الكتابة.");
            long[] stamp = times == null ? null : times[s];
            if (stamp != null && stamp.length != strokes[s].length)
                throw new IllegalArgumentException("عينات وقت الكتابة غير متطابقة.");
            for (int p = 0; p < strokes[s].length; p++) {
                double[] point = strokes[s][p];
                if (point == null || point.length != 2 || !Double.isFinite(point[0]) ||
                        !Double.isFinite(point[1]) || point[0] < 0 || point[0] > 1000 || point[1] < 0 || point[1] > 1000)
                    throw new IllegalArgumentException("إحداثيات الكتابة غير صالحة.");
                if (stamp != null && (stamp[p] < 0 || stamp[p] > 9007199254740991L || (p > 0 && stamp[p] < stamp[p - 1])))
                    throw new IllegalArgumentException("تسلسل وقت الكتابة غير صالح.");
            }
        }
    }
    private HandwritingInput() {}
}
