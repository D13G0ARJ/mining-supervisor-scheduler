import { generateSchedule, validateSchedule, getTwoDrillersStartDayIndex } from '../src/logic/scheduler.js';

const cases = [
  { N: 14, M: 7, induction: 5, totalDays: 90 },
  { N: 21, M: 7, induction: 3, totalDays: 90 },
  { N: 10, M: 5, induction: 2, totalDays: 90 },
  { N: 14, M: 6, induction: 4, totalDays: 950 },
];

for (const params of cases) {
  const label = `${params.N}x${params.M} I${params.induction} T${params.totalDays}`;
  try {
    const schedule = generateSchedule(params);
    const strictStart = getTwoDrillersStartDayIndex(params);
    const errors = validateSchedule(schedule, params.totalDays, strictStart);
    const s2Rest = schedule.s2.filter((v) => v === 'D').length;
    const s3Rest = schedule.s3.filter((v) => v === 'D').length;
    console.log(`${label}: errors=${errors.length} | S2 D=${s2Rest} | S3 D=${s3Rest}`);
  } catch (e) {
    console.log(`${label}: FAIL: ${e?.message || e}`);
  }
}
