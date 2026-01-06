import { generateSchedule } from '../src/logic/scheduler.js';

const totals = [60, 90, 120, 180, 240];

for (const totalDays of totals) {
  for (let N = 3; N <= 25; N++) {
    for (let M = 3; M <= 10; M++) {
      for (let induction = 1; induction <= 5; induction++) {
        // skip obviously invalid inputs (App also blocks these)
        if (N <= induction + 1) continue;

        const params = { N, M, induction, totalDays };
        try {
          generateSchedule(params);
        } catch {
          console.log(`FAIL found: N=${N} M=${M} induction=${induction} totalDays=${totalDays}`);
          process.exit(0);
        }
      }
    }
  }
}

console.log('No FAIL found in searched range.');
