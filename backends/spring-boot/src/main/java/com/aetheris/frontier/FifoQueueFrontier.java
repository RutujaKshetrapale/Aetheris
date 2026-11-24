package com.aetheris.frontier;

import java.util.*;

public class FifoQueueFrontier implements ReversibleFrontier<String> {
    private final Deque<String> queue = new ArrayDeque<>();
    private final Set<String> inQueue = new HashSet<>();

    @Override
    public void push(String element) {
        queue.addLast(element);
        inQueue.add(element);
    }

    @Override
    public String pop() {
        String element = queue.pollFirst();
        if (element != null) {
            inQueue.remove(element);
        }
        return element;
    }

    @Override
    public boolean isEmpty() {
        return queue.isEmpty();
    }

    @Override
    public int size() {
        return queue.size();
    }

    @Override
    public boolean contains(String id) {
        return inQueue.contains(id);
    }

    @Override
    public void clear() {
        queue.clear();
        inQueue.clear();
    }

    @Override
    public List<String> getFrontierIds() {
        return new ArrayList<>(queue);
    }
}
