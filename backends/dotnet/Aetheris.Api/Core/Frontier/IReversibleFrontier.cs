namespace Aetheris.Core.Frontier;

public interface IReversibleFrontier<T>
{
    void Push(T element);
    T Pop();
    bool IsEmpty { get; }
    int Count { get; }
    bool Contains(string id);
    void Clear();
    List<string> GetFrontierIds();
}
