using Aetheris.Core.Domain;

namespace Aetheris.Core.Ports;

public interface IBenchmarkRepository
{
    Task<BenchmarkRecord> SaveAsync(BenchmarkRecord record);
    Task<BenchmarkRecord?> GetByIdAsync(string id);
    Task<IEnumerable<BenchmarkRecord>> GetAllAsync();
    string AdapterType { get; }
    bool IsAvailable { get; }
    bool IsDatabaseConnected { get; }
}
