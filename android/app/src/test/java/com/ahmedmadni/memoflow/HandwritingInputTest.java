package com.ahmedmadni.memoflow;
import org.junit.Test;
import static org.junit.Assert.assertThrows;

public class HandwritingInputTest {
    @Test public void acceptsLegacyAndTimedInkWithoutInventingTimes() {
        double[][][] points = {{{0, 0}, {1000, 1000}}};
        HandwritingInput.validate(points, null, 1.4, 60);
        HandwritingInput.validate(points, new long[][]{{100, 101}}, .7, 40);
        HandwritingInput.validate(points, new long[][]{null}, 1, 40);
    }
    @Test public void refusesCorruptCoordinatesAndTiming() {
        double[][][] points = {{{1, 2}, {3, 4}}};
        assertThrows(IllegalArgumentException.class, () -> HandwritingInput.validate(points, new long[][]{{2}}, 1, 40));
        assertThrows(IllegalArgumentException.class, () -> HandwritingInput.validate(points, new long[][]{{2, 1}}, 1, 40));
        assertThrows(IllegalArgumentException.class, () -> HandwritingInput.validate(new double[][][]{{{Double.NaN, 0}}}, null, 1, 40));
        assertThrows(IllegalArgumentException.class, () -> HandwritingInput.validate(new double[][][]{{{1001, 0}}}, null, 1, 40));
        assertThrows(IllegalArgumentException.class, () -> HandwritingInput.validate(new double[0][][], null, 1, 40));
        assertThrows(IllegalArgumentException.class, () -> HandwritingInput.validate(points, null, 0, 40));
    }
}
