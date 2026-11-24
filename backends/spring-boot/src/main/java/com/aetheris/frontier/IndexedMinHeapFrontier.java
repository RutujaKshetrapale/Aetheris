package com.aetheris.frontier;

import com.aetheris.domain.model.HeapSwap;

import java.util.*;

public class IndexedMinHeapFrontier implements ReversibleFrontier<IndexedMinHeapFrontier.HeapNode> {

    public static class HeapNode {
        public final String id;
        public final int row;
        public final int col;
        public int gCost;
        public int hCost;
        public int fCost;
        public final long seq;

        public HeapNode(String id, int row, int col, int gCost, int hCost, int fCost, long seq) {
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
    private final List<HeapSwap> swaps = new ArrayList<>();

    public IndexedMinHeapFrontier(boolean isAStar) {
        this.isAStar = isAStar;
    }

    public List<HeapSwap> drainSwaps() {
        List<HeapSwap> result = new ArrayList<>(swaps);
        swaps.clear();
        return result;
    }

    private int compare(HeapNode a, HeapNode b) {
        if (isAStar) {
            if (a.fCost != b.fCost) {
                return Integer.compare(a.fCost, b.fCost);
            }
            if (a.hCost != b.hCost) {
                return Integer.compare(a.hCost, b.hCost);
            }
            return Long.compare(a.seq, b.seq);
        } else {
            if (a.gCost != b.gCost) {
                return Integer.compare(a.gCost, b.gCost);
            }
            return Long.compare(a.seq, b.seq);
        }
    }

    private void swap(int i, int j) {
        HeapNode nodeA = heap.get(i);
        HeapNode nodeB = heap.get(j);
        heap.set(i, nodeB);
        heap.set(j, nodeA);
        indexMap.put(nodeB.id, i);
        indexMap.put(nodeA.id, j);
        swaps.add(new HeapSwap(i, j, nodeA.id, nodeB.id));
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

    public void decreaseKey(String id, int newGCost, int newFCost) {
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
        swaps.clear();
    }

    @Override
    public List<String> getFrontierIds() {
        List<String> list = new ArrayList<>(heap.size());
        for (HeapNode n : heap) {
            list.add(n.id);
        }
        return list;
    }
}
