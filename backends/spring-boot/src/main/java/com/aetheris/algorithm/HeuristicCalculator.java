package com.aetheris.algorithm;

import com.aetheris.domain.model.HeuristicType;

public class HeuristicCalculator {
    public static double calculate(HeuristicType type, int r1, int c1, int r2, int c2) {
        if (type == null) type = HeuristicType.MANHATTAN;
        switch (type) {
            case EUCLIDEAN:
                return Math.sqrt(Math.pow(r1 - r2, 2) + Math.pow(c1 - c2, 2));
            case CHEBYSHEV:
                return Math.max(Math.abs(r1 - r2), Math.abs(c1 - c2));
            case MANHATTAN:
            default:
                return Math.abs(r1 - r2) + Math.abs(c1 - c2);
        }
    }
}
