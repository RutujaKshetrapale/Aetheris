namespace Aetheris.Core.Frontier;

public class IndexedMinHeapFrontier : IReversibleFrontier<IndexedMinHeapFrontier.HeapNode>
{
    public class HeapNode
    {
        public string Id { get; }
        public int Row { get; }
        public int Col { get; }
        public double GCost { get; set; }
        public double HCost { get; set; }
        public double FCost { get; set; }
        public long Seq { get; }

        public HeapNode(string id, int row, int col, double gCost, double hCost, double fCost, long seq)
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

    public IndexedMinHeapFrontier(bool isAStar)
    {
        _isAStar = isAStar;
    }

    private int Compare(HeapNode a, HeapNode b)
    {
        if (Math.Abs(a.FCost - b.FCost) > 1e-9)
        {
            return a.FCost.CompareTo(b.FCost);
        }
        if (_isAStar && Math.Abs(a.HCost - b.HCost) > 1e-9)
        {
            return a.HCost.CompareTo(b.HCost);
        }
        if (a.Seq != b.Seq)
        {
            return a.Seq.CompareTo(b.Seq);
        }
        if (a.Row != b.Row)
        {
            return a.Row.CompareTo(b.Row);
        }
        return a.Col.CompareTo(b.Col);
    }

    private void Swap(int i, int j)
    {
        var temp = _heap[i];
        _heap[i] = _heap[j];
        _heap[j] = temp;
        _indexMap[_heap[i].Id] = i;
        _indexMap[_heap[j].Id] = j;
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

    public void Update(string id, double newGCost, double newFCost)
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
        int size = _heap.Count;
        while (true)
        {
            int left = 2 * idx + 1;
            int right = 2 * idx + 2;
            int smallest = idx;
            if (left < size && Compare(_heap[left], _heap[smallest]) < 0)
            {
                smallest = left;
            }
            if (right < size && Compare(_heap[right], _heap[smallest]) < 0)
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
    }
}
