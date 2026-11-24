using Aetheris.Core.Domain;

namespace Aetheris.Core.Frontier;

public class IndexedMinHeapFrontier : IReversibleFrontier<IndexedMinHeapFrontier.HeapNode>
{
    public class HeapNode
    {
        public string Id { get; }
        public int Row { get; }
        public int Col { get; }
        public int GCost { get; set; }
        public int HCost { get; set; }
        public int FCost { get; set; }
        public long Seq { get; }

        public HeapNode(string id, int row, int col, int gCost, int hCost, int fCost, long seq)
        {
            Id = id;
            Row = row;
            Col = col;
            GCost = gCost;
            HCost = hCost;
            FCost = fCost;
            Seq = seq;
        }
    }

    private readonly bool _isAStar;
    private readonly List<HeapNode> _heap = new();
    private readonly Dictionary<string, int> _indexMap = new();
    private readonly List<HeapSwap> _swaps = new();

    public IndexedMinHeapFrontier(bool isAStar)
    {
        _isAStar = isAStar;
    }

    public List<HeapSwap> DrainSwaps()
    {
        var result = new List<HeapSwap>(_swaps);
        _swaps.Clear();
        return result;
    }

    private int Compare(HeapNode a, HeapNode b)
    {
        if (_isAStar)
        {
            if (a.FCost != b.FCost) return a.FCost.CompareTo(b.FCost);
            if (a.HCost != b.HCost) return a.HCost.CompareTo(b.HCost);
            return a.Seq.CompareTo(b.Seq);
        }
        else
        {
            if (a.GCost != b.GCost) return a.GCost.CompareTo(b.GCost);
            return a.Seq.CompareTo(b.Seq);
        }
    }

    private void Swap(int i, int j)
    {
        var nodeA = _heap[i];
        var nodeB = _heap[j];
        _heap[i] = nodeB;
        _heap[j] = nodeA;
        _indexMap[nodeB.Id] = i;
        _indexMap[nodeA.Id] = j;
        _swaps.Add(new HeapSwap(i, j, nodeA.Id, nodeB.Id));
    }

    public void Push(HeapNode element)
    {
        _heap.Add(element);
        int idx = _heap.Count - 1;
        _indexMap[element.Id] = idx;
        SiftUp(idx);
    }

    public HeapNode Pop()
    {
        if (_heap.Count == 0) throw new InvalidOperationException("Heap is empty");
        var top = _heap[0];
        var last = _heap[^1];
        _heap.RemoveAt(_heap.Count - 1);
        _indexMap.Remove(top.Id);
        if (_heap.Count > 0)
        {
            _heap[0] = last;
            _indexMap[last.Id] = 0;
            SiftDown(0);
        }
        return top;
    }

    public void DecreaseKey(string id, int newGCost, int newFCost)
    {
        if (!_indexMap.TryGetValue(id, out int idx)) return;
        var node = _heap[idx];
        node.GCost = newGCost;
        node.FCost = newFCost;
        SiftUp(idx);
    }

    private void SiftUp(int idx)
    {
        while (idx > 0)
        {
            int parent = (idx - 1) / 2;
            if (Compare(_heap[idx], _heap[parent]) < 0)
            {
                Swap(idx, parent);
                idx = parent;
            }
            else
            {
                break;
            }
        }
    }

    private void SiftDown(int idx)
    {
        int count = _heap.Count;
        while (true)
        {
            int left = 2 * idx + 1;
            int right = 2 * idx + 2;
            int smallest = idx;

            if (left < count && Compare(_heap[left], _heap[smallest]) < 0)
            {
                smallest = left;
            }
            if (right < count && Compare(_heap[right], _heap[smallest]) < 0)
            {
                smallest = right;
            }

            if (smallest != idx)
            {
                Swap(idx, smallest);
                idx = smallest;
            }
            else
            {
                break;
            }
        }
    }

    public bool IsEmpty => _heap.Count == 0;
    public int Count => _heap.Count;
    public bool Contains(string id) => _indexMap.ContainsKey(id);

    public void Clear()
    {
        _heap.Clear();
        _indexMap.Clear();
        _swaps.Clear();
    }

    public List<string> GetFrontierIds()
    {
        var list = new List<string>(_heap.Count);
        foreach (var node in _heap)
        {
            list.Add(node.Id);
        }
        return list;
    }
}
