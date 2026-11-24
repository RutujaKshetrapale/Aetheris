package com.aetheris.domain.model;

public class HeapSwap {
    private int indexA;
    private int indexB;
    private String nodeA;
    private String nodeB;

    public HeapSwap() {}

    public HeapSwap(int indexA, int indexB, String nodeA, String nodeB) {
        this.indexA = indexA;
        this.indexB = indexB;
        this.nodeA = nodeA;
        this.nodeB = nodeB;
    }

    public int getIndexA() { return indexA; }
    public void setIndexA(int indexA) { this.indexA = indexA; }

    public int getIndexB() { return indexB; }
    public void setIndexB(int indexB) { this.indexB = indexB; }

    public String getNodeA() { return nodeA; }
    public void setNodeA(String nodeA) { this.nodeA = nodeA; }

    public String getNodeB() { return nodeB; }
    public void setNodeB(String nodeB) { this.nodeB = nodeB; }
}
