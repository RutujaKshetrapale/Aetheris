package com.aetheris.frontier;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class IndexedMinHeapFrontier implements ReversibleFrontier<IndexedMinHeapFrontier.HeapNode> {

    public static class HeapNode {
        public final String id;
        public final int row;
        public final int col;
        public double gCost;
        public double hCost;
        public double fCost;
        public final long seq;

        public HeapNode(String id, int row, int col, double gCost, double hCost, double fCost, long seq) {
            this.id = id;
            this.row = row;
            this.col = col;
            this.gCost = gCost;
            this.hCost = hCost;
            this.fCost = fCost;
            this.seq = seq;
        }
    }

    private final boolean isAStar;
    private final List<HeapNode> heap = new ArrayList<>();
    private final Map<String, Integer> indexMap = new HashMap<>();

    public IndexedMinHeapFrontier(boolean isAStar) {
        this.isAStar = isAStar;
    }

    private int compare(HeapNode a, HeapNode b) {
        if (Math.abs(a.fCost - b.fCost) > 1e-9) {
            return Double.compare(a.fCost, b.fCost);
        }
        if (isAStar && Math.abs(a.hCost - b.hCost) > 1e-9) {
            return Double.compare(a.hCost, b.hCost);
        }
        if (a.seq != b.seq) {
            return Long.compare(a.seq, b.seq);
        }
        if (a.row != b.row) {
            return Integer.compare(a.row, b.row);
        }
        return Integer.compare(a.col, b.col);
    }

    private void swap(int i, int j) {
        HeapNode temp = heap.get(i);
        heap.set(i, heap.get(j));
        heap.set(j, temp);
        indexMap.put(heap.get(i).id, i);
        indexMap.put(heap.get(j).id, j);
    }

    @Override
    public void push(HeapNode element) {
        heap.add(element);
        int idx = heap.size() - 1;
        indexMap.put(element.id, idx);
        siftUp(idx);
    }

    @Override
    public HeapNode pop() {
        if (heap.isEmpty()) return null;
        HeapNode top = heap.get(0);
        HeapNode last = heap.remove(heap.size() - 1);
        indexMap.remove(top.id);
        if (!heap.isEmpty()) {
            heap.set(0, last);
            indexMap.put(last.id, 0);
            siftDown(0);
        }
        return top;
    }

    public void update(String id, double newGCost, double newFCost) {
        Integer idx = indexMap.get(id);
        if (idx == null) return;
        HeapNode node = heap.get(idx);
        node.gCost = newGCost;
        node.fCost = newFCost;
        siftUp(idx);
    }

    private void siftUp(int idx) {
        while (idx > 0) {
            int parent = (idx - 1) / 2;
            if (compare(heap.get(idx), heap.get(parent)) < 0) {
                swap(idx, parent);
                idx = parent;
            } else {
                break;
            }
        }
    }

    private void siftDown(int idx) {
        int size = heap.size();
        while (true) {
            int left = 2 * idx + 1;
            int right = 2 * idx + 2;
            int smallest = idx;
            if (left < size && compare(heap.get(left), heap.get(smallest)) < 0) {
                smallest = left;
            }
            if (right < size && compare(heap.get(right), heap.get(smallest)) < 0) {
                smallest = right;
            }
            if (smallest != idx) {
                swap(idx, smallest);
                idx = smallest;
            } else {
                break;
            }
        }
    }

    @Override
    public boolean isEmpty() {
        return heap.isEmpty();
    }

    @Override
    public int size() {
        return heap.size();
    }

    @Override
    public boolean contains(String id) {
        return indexMap.containsKey(id);
    }

    @Override
    public void clear() {
        heap.clear();
        indexMap.clear();
    }
}
