using Aetheris.Core.Domain;
using Aetheris.Core.Ports;

namespace Aetheris.Adapters.Persistence;

public class MongoBenchmarkAdapter : IBenchmarkRepository
{
    public Task<BenchmarkRecord> SaveAsync(BenchmarkRecord record) =>
        throw new NotSupportedException("MongoDB benchmark persistence adapter pending Phase 4 implementation.");

    public Task<BenchmarkRecord?> GetByIdAsync(string id) => Task.FromResult<BenchmarkRecord?>(null);
    public Task<IEnumerable<BenchmarkRecord>> GetAllAsync() => Task.FromResult<IEnumerable<BenchmarkRecord>>(Array.Empty<BenchmarkRecord>());
    public string AdapterType => "MONGODB";
    public bool IsAvailable => false;
    public bool IsDatabaseConnected => false;
}
