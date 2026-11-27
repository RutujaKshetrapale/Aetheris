using Aetheris.Core.Domain;
using Aetheris.Core.Exceptions;
using Aetheris.Core.Ports;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using MongoDB.Driver;

namespace Aetheris.Adapters.Persistence;

/// <summary>
/// MongoDB.Driver benchmark persistence adapter for MongoDB 9.0.
/// </summary>
public class MongoBenchmarkAdapter : IBenchmarkRepository
{
    private readonly MongoConnectionContext _context;

    public MongoBenchmarkAdapter(MongoConnectionContext context)
    {
        _context = context;
    }

    private IMongoCollection<BenchmarkMongoDocument> Collection()
    {
        EnsureConfigured();
        return _context.Database!.GetCollection<BenchmarkMongoDocument>("benchmarks");
    }

    public async Task<BenchmarkRecord> SaveAsync(BenchmarkRecord record)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(record.Id))
            {
                record.Id = $"bench-{Guid.NewGuid():N}"[..18];
            }
            string createdIso = PersistenceTimeHelper.ToIsoUtc(
                PersistenceTimeHelper.ParseUtcOrNow(record.CreatedAt, DateTime.UtcNow));
            record.CreatedAt = createdIso;

            var doc = new BenchmarkMongoDocument
            {
                MongoId = ObjectId.GenerateNewId(),
                DomainId = record.Id,
                Name = record.Name,
                PresetId = record.PresetId,
                Algorithm = record.Algorithm.ToString(),
                Heuristic = record.Heuristic.ToString(),
                GridRows = record.GridRows,
                GridCols = record.GridCols,
                StartNode = record.StartNode,
                TargetNode = record.TargetNode,
                PathFound = record.PathFound,
                PathNodeCount = record.PathNodeCount,
                PathEdgeCount = record.PathEdgeCount,
                AlgorithmPathCost = record.AlgorithmPathCost,
                TerrainPathCost = record.TerrainPathCost,
                NodesVisited = record.NodesVisited,
                MaxFrontierSize = record.MaxFrontierSize,
                TotalSteps = record.TotalSteps,
                ExecutionTimeMs = record.ExecutionTimeMs,
                CreatedAt = createdIso
            };

            await Collection().InsertOneAsync(doc);
            return ToDomain(doc);
        }
        catch (Exception ex) when (IsMongoException(ex))
        {
            throw Unavailable();
        }
    }

    public async Task<BenchmarkRecord?> GetByIdAsync(string id)
    {
        try
        {
            var doc = await Collection().Find(d => d.DomainId == id).FirstOrDefaultAsync();
            return doc == null ? null : ToDomain(doc);
        }
        catch (Exception ex) when (IsMongoException(ex))
        {
            throw Unavailable();
        }
    }

    public async Task<IEnumerable<BenchmarkRecord>> GetAllAsync()
    {
        try
        {
            var docs = await Collection()
                .Find(Builders<BenchmarkMongoDocument>.Filter.Empty)
                .SortBy(d => d.CreatedAt)
                .ToListAsync();
            return docs.Select(ToDomain).ToList();
        }
        catch (Exception ex) when (IsMongoException(ex))
        {
            throw Unavailable();
        }
    }

    public string AdapterType => "MONGODB";
    public bool IsAvailable => _context.IsDatabaseConnected();
    public bool IsDatabaseConnected => _context.IsDatabaseConnected();

    private void EnsureConfigured()
    {
        if (!_context.IsConfigValid || _context.Database == null)
        {
            throw new PersistenceUnavailableException("MONGODB", _context.ConfigError ?? "MongoDB configuration is invalid.");
        }
    }

    private static PersistenceUnavailableException Unavailable() =>
        new("MONGODB", "MongoDB persistence is currently unavailable.");

    private static bool IsMongoException(Exception ex) =>
        ex is MongoException or TimeoutException;

    private static BenchmarkRecord ToDomain(BenchmarkMongoDocument doc) => new()
    {
        Id = doc.DomainId,
        Name = doc.Name,
        PresetId = doc.PresetId,
        Algorithm = Enum.Parse<AlgorithmType>(doc.Algorithm),
        Heuristic = Enum.Parse<HeuristicType>(doc.Heuristic),
        GridRows = doc.GridRows,
        GridCols = doc.GridCols,
        StartNode = doc.StartNode,
        TargetNode = doc.TargetNode,
        PathFound = doc.PathFound,
        PathNodeCount = doc.PathNodeCount,
        PathEdgeCount = doc.PathEdgeCount,
        AlgorithmPathCost = doc.AlgorithmPathCost,
        TerrainPathCost = doc.TerrainPathCost,
        NodesVisited = doc.NodesVisited,
        MaxFrontierSize = doc.MaxFrontierSize,
        TotalSteps = doc.TotalSteps,
        ExecutionTimeMs = doc.ExecutionTimeMs,
        CreatedAt = doc.CreatedAt
    };

    private sealed class BenchmarkMongoDocument
    {
        [BsonId]
        public ObjectId MongoId { get; set; }

        [BsonElement("id")]
        public string DomainId { get; set; } = string.Empty;

        [BsonElement("name")]
        public string? Name { get; set; }

        [BsonElement("presetId")]
        public string? PresetId { get; set; }

        [BsonElement("algorithm")]
        public string Algorithm { get; set; } = string.Empty;

        [BsonElement("heuristic")]
        public string Heuristic { get; set; } = string.Empty;

        [BsonElement("gridRows")]
        public int GridRows { get; set; }

        [BsonElement("gridCols")]
        public int GridCols { get; set; }

        [BsonElement("startNode")]
        public string StartNode { get; set; } = string.Empty;

        [BsonElement("targetNode")]
        public string TargetNode { get; set; } = string.Empty;

        [BsonElement("pathFound")]
        public bool PathFound { get; set; }

        [BsonElement("pathNodeCount")]
        public int PathNodeCount { get; set; }

        [BsonElement("pathEdgeCount")]
        public int PathEdgeCount { get; set; }

        [BsonElement("algorithmPathCost")]
        public int? AlgorithmPathCost { get; set; }

        [BsonElement("terrainPathCost")]
        public int? TerrainPathCost { get; set; }

        [BsonElement("nodesVisited")]
        public int NodesVisited { get; set; }

        [BsonElement("maxFrontierSize")]
        public int MaxFrontierSize { get; set; }

        [BsonElement("totalSteps")]
        public int TotalSteps { get; set; }

        [BsonElement("executionTimeMs")]
        public double ExecutionTimeMs { get; set; }

        [BsonElement("createdAt")]
        public string CreatedAt { get; set; } = string.Empty;
    }
}
