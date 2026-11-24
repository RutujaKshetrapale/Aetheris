package com.aetheris.frontier;

import java.util.*;

public class LifoStackFrontier implements ReversibleFrontier<String> {
    private final Deque<String> stack = new ArrayDeque<>();
    private final Set<String> inStack = new HashSet<>();

    @Override
    public void push(String element) {
        stack.push(element);
        inStack.add(element);
    }

    @Override
    public String pop() {
        String element = stack.pop();
        inStack.remove(element);
        return element;
    }

    @Override
    public boolean isEmpty() {
        return stack.isEmpty();
    }

    @Override
    public int size() {
        return stack.size();
    }

    @Override
    public boolean contains(String id) {
        return inStack.contains(id);
    }

    @Override
    public void clear() {
        stack.clear();
        inStack.clear();
    }

    @Override
    public List<String> getFrontierIds() {
        return new ArrayList<>(stack);
    }
}
