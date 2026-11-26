using System.Collections.Concurrent;
using Aetheris.Core.Domain;
using Aetheris.Core.Ports;

namespace Aetheris.Adapters.Persistence;

public class InMemoryBenchmarkAdapter : IBenchmarkRepository
{
    private readonly ConcurrentDictionary<string, BenchmarkRecord> _storage = new();

    public Task<BenchmarkRecord> SaveAsync(BenchmarkRecord record)
    {
        if (string.IsNullOrWhiteSpace(record.Id))
        {
            record.Id = $"bench-{Guid.NewGuid():N}"[..18];
        }
        _storage[record.Id] = record;
        return Task.FromResult(record);
    }

    public Task<BenchmarkRecord?> GetByIdAsync(string id) =>
        Task.FromResult(_storage.TryGetValue(id, out var record) ? record : null);

    public Task<IEnumerable<BenchmarkRecord>> GetAllAsync() =>
        Task.FromResult<IEnumerable<BenchmarkRecord>>(_storage.Values.OrderBy(r => r.CreatedAt, StringComparer.Ordinal).ToList());

    public string AdapterType => "IN_MEMORY";
    public bool IsAvailable => true;
    public bool IsDatabaseConnected => false;
}
