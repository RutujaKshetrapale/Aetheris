namespace Aetheris.Core.Frontier;

public class FifoQueueFrontier : IReversibleFrontier<string>
{
    private readonly Queue<string> _queue = new();
    private readonly HashSet<string> _inQueue = new();

    public void Push(string element)
    {
        _queue.Enqueue(element);
        _inQueue.Add(element);
    }

    public string Pop()
    {
        string element = _queue.Dequeue();
        _inQueue.Remove(element);
        return element;
    }

    public bool IsEmpty => _queue.Count == 0;
    public int Count => _queue.Count;
    public bool Contains(string id) => _inQueue.Contains(id);
    public void Clear()
    {
        _queue.Clear();
        _inQueue.Clear();
    }

    public List<string> GetFrontierIds() => new(_queue);
}
