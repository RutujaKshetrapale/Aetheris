package com.aetheris.frontier;

public interface ReversibleFrontier<T> {
    void push(T element);
    T pop();
    boolean isEmpty();
    int size();
    boolean contains(String id);
    void clear();
}
