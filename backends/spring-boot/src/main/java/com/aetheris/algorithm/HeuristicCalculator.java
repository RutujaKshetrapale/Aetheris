package com.aetheris.algorithm;

import com.aetheris.domain.model.HeuristicType;

public class HeuristicCalculator {
    public static int calculate(HeuristicType type, int r1, int c1, int r2, int c2) {
        // Manhattan heuristic multiplied by min positive traversable entry cost (1)
        return Math.abs(r1 - r2) + Math.abs(c1 - c2);
    }
}
