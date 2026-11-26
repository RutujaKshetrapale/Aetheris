package com.aetheris.algorithm;

import com.aetheris.domain.model.HeuristicType;

public class HeuristicCalculator {
    public static int calculate(HeuristicType type, int r1, int c1, int r2, int c2) {
        return calculate(type, r1, c1, r2, c2, 1);
    }

    public static int calculate(HeuristicType type, int r1, int c1, int r2, int c2, int minWeight) {
        int weight = Math.max(1, minWeight);
        return (Math.abs(r1 - r2) + Math.abs(c1 - c2)) * weight;
    }
}
