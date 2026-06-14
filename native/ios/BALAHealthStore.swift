import Foundation
import HealthKit

struct BALADailySummary: Codable {
    let date: Date
    let steps: Double?
    let restingHeartRate: Double?
    let heartRateVariability: Double?
    let oxygenSaturation: Double?
    let exerciseMinutes: Double?
}

actor BALAHealthStore {
    private let store = HKHealthStore()

    private var readTypes: Set<HKObjectType> {
        [
            HKQuantityType(.stepCount),
            HKQuantityType(.restingHeartRate),
            HKQuantityType(.heartRateVariabilitySDNN),
            HKQuantityType(.oxygenSaturation),
            HKQuantityType(.appleExerciseTime),
            HKCategoryType(.sleepAnalysis),
        ]
    }

    func requestAuthorization() async throws {
        guard HKHealthStore.isHealthDataAvailable() else {
            throw HealthStoreError.unavailable
        }
        try await store.requestAuthorization(toShare: [], read: readTypes)
    }

    func summary(for date: Date = .now) async throws -> BALADailySummary {
        let interval = Calendar.current.dateInterval(of: .day, for: date)!
        async let steps = cumulative(.stepCount, unit: .count(), interval: interval)
        async let restingHeartRate = average(
            .restingHeartRate,
            unit: .count().unitDivided(by: .minute()),
            interval: interval
        )
        async let hrv = average(.heartRateVariabilitySDNN, unit: .secondUnit(with: .milli), interval: interval)
        async let oxygen = average(.oxygenSaturation, unit: .percent(), interval: interval)
        async let exercise = cumulative(.appleExerciseTime, unit: .minute(), interval: interval)

        return try await BALADailySummary(
            date: interval.start,
            steps: steps,
            restingHeartRate: restingHeartRate,
            heartRateVariability: hrv,
            oxygenSaturation: oxygen.map { $0 * 100 },
            exerciseMinutes: exercise
        )
    }

    private func cumulative(
        _ identifier: HKQuantityTypeIdentifier,
        unit: HKUnit,
        interval: DateInterval
    ) async throws -> Double? {
        let type = HKQuantityType(identifier)
        let predicate = HKQuery.predicateForSamples(
            withStart: interval.start,
            end: interval.end
        )
        let descriptor = HKStatisticsQueryDescriptor(
            predicate: .quantitySample(type: type, predicate: predicate),
            options: .cumulativeSum
        )
        return try await descriptor.result(for: store)?
            .sumQuantity()?
            .doubleValue(for: unit)
    }

    private func average(
        _ identifier: HKQuantityTypeIdentifier,
        unit: HKUnit,
        interval: DateInterval
    ) async throws -> Double? {
        let type = HKQuantityType(identifier)
        let predicate = HKQuery.predicateForSamples(
            withStart: interval.start,
            end: interval.end
        )
        let descriptor = HKStatisticsQueryDescriptor(
            predicate: .quantitySample(type: type, predicate: predicate),
            options: .discreteAverage
        )
        return try await descriptor.result(for: store)?
            .averageQuantity()?
            .doubleValue(for: unit)
    }
}

enum HealthStoreError: Error {
    case unavailable
}
