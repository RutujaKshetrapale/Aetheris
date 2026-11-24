package com.aetheris.frontier;

import java.util.List;

public interface ReversibleFrontier<T> {
    void push(T element);
    T pop();
    boolean isEmpty();
    int size();
    boolean contains(String id);
    void clear();
    List<String> getFrontierIds();
}
