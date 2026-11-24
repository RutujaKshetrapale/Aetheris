package com.aetheris.algorithm;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class NodeIdUtil {
    private static final Pattern PATTERN = Pattern.compile("^r(\\d+)c(\\d+)$");

    public static String format(int row, int col) {
        return "r" + row + "c" + col;
    }

    public static int[] parse(String id) {
        Matcher matcher = PATTERN.matcher(id);
        if (!matcher.matches()) {
            throw new IllegalArgumentException("Invalid node id format: " + id);
        }
        return new int[]{ Integer.parseInt(matcher.group(1)), Integer.parseInt(matcher.group(2)) };
    }
}
