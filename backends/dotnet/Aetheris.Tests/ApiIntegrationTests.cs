using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Aetheris.Tests;

public class ApiIntegrationTests
{
    private static async Task<(WebApplication App, HttpClient Client)> StartTestServerAsync(string persistenceEngine = "IN_MEMORY")
    {
        var app = AetherisAppFactory.BuildApp(
            new[] { "--urls", "http://127.0.0.1:0" },
            new Dictionary<string, string?>
            {
                ["Aetheris:Persistence:Engine"] = persistenceEngine
            });

        await app.StartAsync();
        var server = app.Services.GetRequiredService<IServer>();
        var addresses = server.Features.Get<IServerAddressesFeature>()!.Addresses;
        var baseUrl = addresses.First();
        var client = new HttpClient { BaseAddress = new Uri(baseUrl) };
        return (app, client);
    }

    [Fact]
    public async Task HealthEndpointsReportHonestInMemoryState()
    {
        var (app, client) = await StartTestServerAsync();
        try
        {
            var live = await client.GetAsync("/api/v1/health/live");
            Assert.Equal(HttpStatusCode.OK, live.StatusCode);

            var ready = await client.GetAsync("/api/v1/health/ready");
            Assert.Equal(HttpStatusCode.OK, ready.StatusCode);

            var health = await client.GetAsync("/api/v1/health");
            Assert.Equal(HttpStatusCode.OK, health.StatusCode);
            using var doc = JsonDocument.Parse(await health.Content.ReadAsStringAsync());
            var root = doc.RootElement;
            Assert.Equal("UP", root.GetProperty("status").GetString());
            Assert.Equal("UP", root.GetProperty("engineStatus").GetString());
            Assert.Equal("IN_MEMORY", root.GetProperty("persistenceEngine").GetString());
            Assert.Equal("UP", root.GetProperty("persistenceStatus").GetString());
            Assert.False(root.GetProperty("databaseConnected").GetBoolean());
        }
        finally
        {
            client.Dispose();
            await app.StopAsync();
            await app.DisposeAsync();
        }
    }

    [Fact]
    public async Task PathfindingAllAlgorithmsAndValidationErrors()
    {
        var (app, client) = await StartTestServerAsync();
        try
        {
            string gridJson = """
                {
                  "rows": 5,
                  "cols": 5,
                  "startNode": "r0c0",
                  "targetNode": "r4c4",
                  "cells": [
                    {"id":"r0c0","row":0,"col":0,"cellType":"START","weight":1},
                    {"id":"r4c4","row":4,"col":4,"cellType":"TARGET","weight":1},
                    {"id":"r1c2","row":1,"col":2,"cellType":"WALL","weight":1},
                    {"id":"r2c2","row":2,"col":2,"cellType":"WALL","weight":1},
                    {"id":"r3c2","row":3,"col":2,"cellType":"WALL","weight":1},
                    {"id":"r0c2","row":0,"col":2,"cellType":"WEIGHTED","weight":5}
                  ]
                }
                """;

            foreach (var algo in new[] { "BFS", "DFS", "DIJKSTRA", "ASTAR" })
            {
                var content = new StringContent($"{{\"algorithm\":\"{algo}\",\"grid\":{gridJson}}}", Encoding.UTF8, "application/json");
                var res = await client.PostAsync("/api/v1/pathfinding/trace", content);
                Assert.Equal(HttpStatusCode.OK, res.StatusCode);
                using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
                Assert.Equal(algo, doc.RootElement.GetProperty("algorithm").GetString());
                Assert.True(doc.RootElement.GetProperty("pathFound").GetBoolean());
            }

            // Malformed JSON -> 400 problem+json
            var badJsonRes = await client.PostAsync("/api/v1/pathfinding/trace",
                new StringContent("{bad-json", Encoding.UTF8, "application/json"));
            Assert.Equal(HttpStatusCode.BadRequest, badJsonRes.StatusCode);
            Assert.Contains("application/problem+json", badJsonRes.Content.Headers.ContentType?.ToString());

            // Missing algorithm -> 400 problem+json
            var missingAlgoRes = await client.PostAsync("/api/v1/pathfinding/trace",
                new StringContent("{\"grid\":{\"rows\":3,\"cols\":3,\"startNode\":\"r0c0\",\"targetNode\":\"r2c2\"}}", Encoding.UTF8, "application/json"));
            Assert.Equal(HttpStatusCode.BadRequest, missingAlgoRes.StatusCode);
            Assert.Contains("application/problem+json", missingAlgoRes.Content.Headers.ContentType?.ToString());

            // Out-of-bounds domain coordinates -> 422 problem+json
            var outOfBoundsRes = await client.PostAsync("/api/v1/pathfinding/trace",
                new StringContent("{\"algorithm\":\"BFS\",\"grid\":{\"rows\":3,\"cols\":3,\"startNode\":\"r0c0\",\"targetNode\":\"r9c9\"}}", Encoding.UTF8, "application/json"));
            Assert.Equal(HttpStatusCode.UnprocessableEntity, outOfBoundsRes.StatusCode);
            Assert.Contains("application/problem+json", outOfBoundsRes.Content.Headers.ContentType?.ToString());

            // Wall on startNode -> 422 problem+json
            var wallOnStartRes = await client.PostAsync("/api/v1/pathfinding/trace",
                new StringContent("{\"algorithm\":\"BFS\",\"grid\":{\"rows\":3,\"cols\":3,\"startNode\":\"r0c0\",\"targetNode\":\"r2c2\",\"cells\":[{\"id\":\"r0c0\",\"row\":0,\"col\":0,\"cellType\":\"WALL\",\"weight\":1}]}}", Encoding.UTF8, "application/json"));
            Assert.Equal(HttpStatusCode.UnprocessableEntity, wallOnStartRes.StatusCode);
            Assert.Contains("application/problem+json", wallOnStartRes.Content.Headers.ContentType?.ToString());
        }
        finally
        {
            client.Dispose();
            await app.StopAsync();
            await app.DisposeAsync();
        }
    }

    [Fact]
    public async Task PresetCrudExportImportAndBenchmarksWork()
    {
        var (app, client) = await StartTestServerAsync();
        try
        {
            string createPayload = """
                {
                  "id": "preset-dotnet-p3",
                  "name": "Dotnet Phase 3 Grid",
                  "description": "Integration test preset",
                  "grid": {
                    "rows": 4,
                    "cols": 4,
                    "startNode": "r0c0",
                    "targetNode": "r3c3",
                    "cells": [
                      {"id":"r1c1","row":1,"col":1,"cellType":"WALL","weight":1},
                      {"id":"r2c2","row":2,"col":2,"cellType":"WEIGHTED","weight":8}
                    ]
                  }
                }
                """;

            var createRes = await client.PostAsync("/api/v1/presets", new StringContent(createPayload, Encoding.UTF8, "application/json"));
            Assert.Equal(HttpStatusCode.Created, createRes.StatusCode);

            var dupRes = await client.PostAsync("/api/v1/presets", new StringContent(createPayload, Encoding.UTF8, "application/json"));
            Assert.Equal(HttpStatusCode.Conflict, dupRes.StatusCode);

            var updateRes = await client.PutAsync("/api/v1/presets/preset-dotnet-p3",
                new StringContent(createPayload.Replace("Dotnet Phase 3 Grid", "Dotnet Phase 3 Updated"), Encoding.UTF8, "application/json"));
            Assert.Equal(HttpStatusCode.OK, updateRes.StatusCode);

            var exportRes = await client.PostAsync("/api/v1/presets/export",
                new StringContent("{\"presetIds\":[\"preset-dotnet-p3\"]}", Encoding.UTF8, "application/json"));
            Assert.Equal(HttpStatusCode.OK, exportRes.StatusCode);

            byte[] rawExport = await exportRes.Content.ReadAsByteArrayAsync();
            Assert.False(rawExport.Length >= 3 && rawExport[0] == 0xEF && rawExport[1] == 0xBB && rawExport[2] == 0xBF);
            string exportText = Encoding.UTF8.GetString(rawExport);
            Assert.DoesNotContain("\r\n", exportText);
            Assert.Contains("\n  \"format\": \"aetheris-preset-bundle\"", exportText);

            var delRes = await client.DeleteAsync("/api/v1/presets/preset-dotnet-p3");
            Assert.Equal(HttpStatusCode.NoContent, delRes.StatusCode);

            var missingRes = await client.GetAsync("/api/v1/presets/preset-dotnet-p3");
            Assert.Equal(HttpStatusCode.NotFound, missingRes.StatusCode);

            var importRes = await client.PostAsync("/api/v1/presets/import", new StringContent(exportText, Encoding.UTF8, "application/json"));
            Assert.Equal(HttpStatusCode.OK, importRes.StatusCode);

            // Tampered hash -> 422
            var tamperedRes = await client.PostAsync("/api/v1/presets/import",
                new StringContent(exportText.Replace("Dotnet Phase 3 Updated", "Tampered"), Encoding.UTF8, "application/json"));
            Assert.Equal(HttpStatusCode.UnprocessableEntity, tamperedRes.StatusCode);

            // Benchmark using presetId -> 201
            var benchRes = await client.PostAsync("/api/v1/benchmarks",
                new StringContent("{\"name\":\"Bench from preset\",\"presetId\":\"preset-dotnet-p3\",\"algorithm\":\"ASTAR\"}", Encoding.UTF8, "application/json"));
            Assert.Equal(HttpStatusCode.Created, benchRes.StatusCode);
            using var benchDoc = JsonDocument.Parse(await benchRes.Content.ReadAsStringAsync());
            string benchId = benchDoc.RootElement.GetProperty("id").GetString()!;
            Assert.False(benchDoc.RootElement.TryGetProperty("traceDeltas", out _));

            var getBenchRes = await client.GetAsync($"/api/v1/benchmarks/{benchId}");
            Assert.Equal(HttpStatusCode.OK, getBenchRes.StatusCode);
        }
        finally
        {
            client.Dispose();
            await app.StopAsync();
            await app.DisposeAsync();
        }
    }

    [Fact]
    public async Task PersistenceOutageLeavesPathfindingOperational()
    {
        var (app, client) = await StartTestServerAsync("MYSQL");
        try
        {
            var healthRes = await client.GetAsync("/api/v1/health");
            Assert.Equal(HttpStatusCode.OK, healthRes.StatusCode);
            using var doc = JsonDocument.Parse(await healthRes.Content.ReadAsStringAsync());
            Assert.Equal("MYSQL", doc.RootElement.GetProperty("persistenceEngine").GetString());
            Assert.Equal("UNAVAILABLE", doc.RootElement.GetProperty("persistenceStatus").GetString());
            Assert.False(doc.RootElement.GetProperty("databaseConnected").GetBoolean());

            var readyRes = await client.GetAsync("/api/v1/health/ready");
            Assert.Equal(HttpStatusCode.OK, readyRes.StatusCode);

            var traceRes = await client.PostAsync("/api/v1/pathfinding/trace",
                new StringContent("{\"algorithm\":\"BFS\",\"grid\":{\"rows\":3,\"cols\":3,\"startNode\":\"r0c0\",\"targetNode\":\"r2c2\"}}", Encoding.UTF8, "application/json"));
            Assert.Equal(HttpStatusCode.OK, traceRes.StatusCode);

            var presetsRes = await client.GetAsync("/api/v1/presets");
            Assert.Equal(HttpStatusCode.ServiceUnavailable, presetsRes.StatusCode);
            Assert.Contains("application/problem+json", presetsRes.Content.Headers.ContentType?.ToString());

            var benchRes = await client.PostAsync("/api/v1/benchmarks",
                new StringContent("{\"algorithm\":\"BFS\",\"grid\":{\"rows\":3,\"cols\":3,\"startNode\":\"r0c0\",\"targetNode\":\"r2c2\"}}", Encoding.UTF8, "application/json"));
            Assert.Equal(HttpStatusCode.ServiceUnavailable, benchRes.StatusCode);
            Assert.Contains("application/problem+json", benchRes.Content.Headers.ContentType?.ToString());
        }
        finally
        {
            client.Dispose();
            await app.StopAsync();
            await app.DisposeAsync();
        }
    }
}
