using Aetheris.Adapters.Persistence;
using Aetheris.Application;
using Aetheris.Core.Domain;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Aetheris.Tests;

public class DatabaseAdapterTests
{
    private static GridPreset SamplePreset(string id) => new(
        id,
        "Phase 4 .NET Test Grid",
        "Adapter roundtrip grid",
        new GridModel(4, 4, "r0c0", "r3c3", new List<CellDefinition>
        {
            new("r0c0", 0, 0, CellType.START, 1),
            new("r3c3", 3, 3, CellType.TARGET, 1),
            new("r1c1", 1, 1, CellType.WALL, 1),
            new("r0c2", 0, 2, CellType.WEIGHTED, 7)
        }),
        DateTime.UtcNow.ToString("O")
    );

    private static BenchmarkRecord SampleBenchmark(string id, string presetId) => new()
    {
        Id = id,
        Name = "Phase 4 .NET Benchmark",
        PresetId = presetId,
        Algorithm = AlgorithmType.DIJKSTRA,
        Heuristic = HeuristicType.MANHATTAN,
        GridRows = 4,
        GridCols = 4,
        StartNode = "r0c0",
        TargetNode = "r3c3",
        PathFound = true,
        PathNodeCount = 7,
        PathEdgeCount = 6,
        AlgorithmPathCost = 12,
        TerrainPathCost = 12,
        NodesVisited = 9,
        MaxFrontierSize = 4,
        TotalSteps = 28,
        ExecutionTimeMs = 1.25,
        CreatedAt = DateTime.UtcNow.ToString("O")
    };

    [Fact]
    public void ConnectionContextsValidateRequiredConfiguration()
    {
        var emptyConfig = new ConfigurationBuilder().Build();
        var mysqlCtx = new MySqlConnectionContext(emptyConfig);
        Assert.False(mysqlCtx.IsConfigValid);
        Assert.False(mysqlCtx.IsDatabaseConnected());

        var mongoCtx = new MongoConnectionContext(emptyConfig);
        Assert.False(mongoCtx.IsConfigValid);
        Assert.False(mongoCtx.IsDatabaseConnected());
    }

    [Fact]
    public async Task MySqlAndMongoAdaptersCrudAndPortabilityWhenDatabasesAvailable()
    {
        string? mysqlConn = Environment.GetEnvironmentVariable("AETHERIS_TEST_MYSQL_CONN");
        string? mongoUri = Environment.GetEnvironmentVariable("AETHERIS_TEST_MONGODB_URI");
        if (string.IsNullOrWhiteSpace(mysqlConn) && string.IsNullOrWhiteSpace(mongoUri))
        {
            return;
        }

        var codec = new PresetBundleCodec();
        string presetId = $"preset-dn-test-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        GridPreset? mysqlSaved = null;

        if (!string.IsNullOrWhiteSpace(mysqlConn))
        {
            var mysqlConfig = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:MySql"] = mysqlConn
                })
                .Build();
            var mysqlCtx = new MySqlConnectionContext(mysqlConfig);
            var mysqlPresets = new MySqlPresetAdapter(mysqlCtx);
            var mysqlBenchmarks = new MySqlBenchmarkAdapter(mysqlCtx);

            Assert.True(mysqlPresets.IsDatabaseConnected);
            mysqlSaved = await mysqlPresets.SaveAsync(SamplePreset(presetId));
            Assert.Equal(presetId, mysqlSaved.Id);

            var fetched = await mysqlPresets.GetByIdAsync(presetId);
            Assert.NotNull(fetched);
            Assert.Equal(4, fetched!.Grid.Cells.Count);

            var bench = await mysqlBenchmarks.SaveAsync(SampleBenchmark($"bench-dn-my-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}", presetId));
            Assert.NotNull(await mysqlBenchmarks.GetByIdAsync(bench.Id));
        }

        if (!string.IsNullOrWhiteSpace(mongoUri))
        {
            var mongoConfig = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:Mongo"] = mongoUri,
                    ["Aetheris:Persistence:MongoDb:Database"] = "aetheris"
                })
                .Build();
            var mongoCtx = new MongoConnectionContext(mongoConfig);
            var mongoPresets = new MongoPresetAdapter(mongoCtx);
            var mongoBenchmarks = new MongoBenchmarkAdapter(mongoCtx);

            Assert.True(mongoPresets.IsDatabaseConnected);

            var source = mysqlSaved ?? SamplePreset(presetId);
            byte[] bundleBytes = codec.EncodePretty(new[] { source });
            var importedList = codec.DecodeAndValidate(bundleBytes);
            var mongoSaved = await mongoPresets.SaveAsync(importedList[0]);
            Assert.Equal(source.Name, mongoSaved.Name);

            var bench = await mongoBenchmarks.SaveAsync(SampleBenchmark($"bench-dn-mg-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}", presetId));
            Assert.NotNull(await mongoBenchmarks.GetByIdAsync(bench.Id));

            Assert.True(await mongoPresets.DeleteByIdAsync(presetId));
        }
    }
}
