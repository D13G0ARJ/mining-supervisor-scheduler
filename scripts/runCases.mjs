import { generateScheduleForRequiredDrillDays, validateSchedule } from '../src/logic/scheduler.js';

const cases = [
  { N: 14, M: 7, induction: 5, requiredDrillDays: 90 },
  { N: 21, M: 7, induction: 3, requiredDrillDays: 90 },
  { N: 10, M: 5, induction: 2, requiredDrillDays: 90 },
  { N: 14, M: 6, induction: 4, requiredDrillDays: 950 },
];

for (const params of cases) {
  const label = `${params.N}x${params.M} I${params.induction} Req${params.requiredDrillDays}`;
  try {
    const { schedule, gracePeriod, totalDays } = generateScheduleForRequiredDrillDays(params);
    const errors = validateSchedule(schedule, totalDays, gracePeriod);
    const s2Rest = schedule.s2.filter((v) => v === 'D').length;
    const s3Rest = schedule.s3.filter((v) => v === 'D').length;
    console.log(`${label}: totalDays=${totalDays} grace=${gracePeriod} errors=${errors.length} | S2 D=${s2Rest} | S3 D=${s3Rest}`);
  } catch (e) {
    console.log(`${label}: FAIL: ${e?.message || e}`);
  }
}
