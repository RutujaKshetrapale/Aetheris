namespace Aetheris.Core.Frontier;

public class LifoStackFrontier : IReversibleFrontier<string>
{
    private readonly Stack<string> _stack = new();
    private readonly HashSet<string> _inStack = new();

    public void Push(string element)
    {
        _stack.Push(element);
        _inStack.Add(element);
    }

    public string Pop()
    {
        string element = _stack.Pop();
        _inStack.Remove(element);
        return element;
    }

    public bool IsEmpty => _stack.Count == 0;
    public int Count => _stack.Count;
    public bool Contains(string id) => _inStack.Contains(id);
    public void Clear()
    {
        _stack.Clear();
        _inStack.Clear();
    }

    public List<string> GetFrontierIds() => new(_stack);
}
