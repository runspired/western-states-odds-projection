import Component from '@glimmer/component';
import { cached } from '@glimmer/tracking';
import { ALL_SEED_DATA } from './odds-setter';

// Example:
// const data = [[1, 2], [2, 4], [3, 6], [4, 8]];
// const [slope, intercept] = linearRegression(data);
// console.log(`Equation: y = ${slope}x + ${intercept}`);
function linearRegression(data) {
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  const n = data.length;

  for (let x = 0; x < n; x++) {
    const y = data[x];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x ** 2;
  }

  const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX ** 2);
  const b = (sumY - m * sumX) / n;

  return [m, b]; // Returns slope and y-intercept
}

function getLinearRegressionLinePoints(data) {
  const [slope, intercept] = linearRegression(data);
  const points = [];
  for (let i = 0; i < data.length; i++) {
    points.push(slope * i + intercept);
  }

  return points;
}

const HistogramColors = [
  'rgba(75, 75, 0, 0.8)',
  'rgba(95, 95, 0, 0.8)',
  'rgba(115, 115, 0, 0.8)',
  'rgba(135, 135, 0, 0.8)',
  'rgba(155, 155, 0, 0.8)',
  'rgba(175, 175, 0, 0.8)',
  'rgba(195, 195, 0, 0.8)',
  'rgba(215, 215, 0, 0.8)',
  'rgba(235, 235, 0, 0.8)',
  'rgba(255, 255, 0, 0.8)',
]

export default class extends Component {
  @cached
  get growthConfig() {
    let maxGroups = 0;
    const yearTotals = [];
    const adjustedSlices = [];
    const slices = [];
    for (const groups of Object.values(ALL_SEED_DATA)) {
      if (groups.length > maxGroups) {
        maxGroups = groups.length;
      }

      const total = groups.reduce((acc, group) => acc + group, 0);
      yearTotals.push(total);

      let runningTotal = 0;
      for (let i = 0; i < groups.length; i++) {
        if (!slices[i]) {
          slices[i] = [];
          adjustedSlices[i] = [];
        }

        slices[i].push(groups[i]);

        runningTotal = runningTotal + groups[i];
        adjustedSlices[i].push(runningTotal);
      }
    }

    const lines = [
          {
            type: 'line',
            label: `Applicant Growth Trend`,
            data: getLinearRegressionLinePoints(yearTotals),
            borderColor: 'rgba(255, 255, 255, 0.8)',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            fill: false,
            borderWidth: 3,
            pointStyle: 'circle',
            radius: 0,
            yAxisID: 'y',
          },
    ];

    // set any slices with missing years to 0
    slices.forEach((slice, i) => {
      const points = slice.length > 1 ? getLinearRegressionLinePoints(slice) : slice.slice();
      while (points.length < maxGroups) {
        points.unshift(null);
      }
      let adjSlice = adjustedSlices[i];
      while (adjSlice.length < maxGroups) {
        adjSlice.unshift(0);
      }

      lines.push({
        type: 'bar',
        label: `${i + 1} Year Applicants`,
        data: adjSlice,
        borderColor: HistogramColors[i],
        backgroundColor: HistogramColors[i],
        fill: true,
        borderWidth: 1,
        pointStyle: 'circle',
        radius: 1,
      });

      // lines.push({
      //   type: 'line',
      //   label: `${i + 1} Year Applicant Trend`,
      //   data: points,
      //   borderColor: colors[i + 2],
      //   backgroundColor: colors[i + 2],
      //   fill: false,
      //   borderWidth: 2,
      //   pointStyle: 'circle',
      //   radius: 2,
      //   yAxisID: 'y',
      // });
    });

    return {
      data: {
        labels: Object.keys(ALL_SEED_DATA),
        datasets: [
          {
            type: 'bar',
            label: 'Total Applicants',
            data: yearTotals,
            borderColor: 'rgba(200, 200, 200, .2)',
            backgroundColor: 'rgba(200, 200, 200, .2)',
            fill: true,
            borderWidth: 1,
            pointStyle: 'circle',
            radius: 1,
          },
          // {
          //   type: 'bar',
          //   label: 'Group Applicants',
          //   data: this.args.model.map((y) => y.totalApplicants),
          //   borderColor: colors[6],
          //   backgroundColor: colors[6],
          //   fill: true,
          //   borderWidth: 1,
          //   pointStyle: 'circle',
          //   radius: 1,
          // },
          ...lines,
        ],
      },
      options: {
        animation: false,
        hover: {
          animationDuration: 0, // duration of animations when hovering an item
        },
        responsiveAnimationDuration: 0, // animation duration after a resize
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            color: '#fff',
            display: true,
            text: 'Applicant Growth By Year',
          },
          legend: {
            labels: {
              color: '#ccc',
            },
          },
        },
        scales: {
          x: {
            display: true,
            stacked: true,
            title: {
              color: '#fff',
              display: true,
              text: 'Year',
            },
            ticks: {
              color: '#ccc',
            },
          },
          y: {
            display: true,
            title: {
              color: '#fff',
              display: true,
              text: 'Applicants',
            },
            ticks: {
              color: '#ccc',
            },
          },
          // y1: {
          //   display: true,
          //   position: 'right',
          //   title: {
          //     color: '#fff',
          //     display: true,
          //     text: 'Years in Lottery',
          //   },
          //   ticks: {
          //     color: '#ccc',
          //   },
          // },
        },
      },
    };
  }

  @cached
  get rateConfig() {
    let maxGroups = 0;
    const adjustedSlices = [];
    for (const groups of Object.values(ALL_SEED_DATA)) {
      if (groups.length > maxGroups) {
        maxGroups = groups.length;
      }

      const total = groups.reduce((acc, group) => acc + group, 0);

      let runningTotal = 0;
      for (let i = 0; i < groups.length; i++) {
        if (!adjustedSlices[i]) {
          adjustedSlices[i] = [];
        }

        runningTotal = runningTotal + groups[i];
        const ratio = groups[i] / total * 100;
        adjustedSlices[i].push(ratio);
      }
    }

    const lines = [];

    // set any slices with missing years to 0
    adjustedSlices.forEach((slice, i) => {
      while (slice.length < maxGroups) {
        slice.unshift(null);
      }

      lines.push({
        type: 'line',
        label: `${i + 1} Year Applicants`,
        data: slice,
        borderColor: HistogramColors[i],
        backgroundColor: HistogramColors[i],
        fill: false,
        borderWidth: 2,
        pointStyle: 'circle',
        radius: 2,
      });
    });

    return {
      data: {
        labels: Object.keys(ALL_SEED_DATA),
        datasets: lines,
      },
      options: {
        animation: false,
        hover: {
          animationDuration: 0, // duration of animations when hovering an item
        },
        responsiveAnimationDuration: 0, // animation duration after a resize
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            color: '#fff',
            display: true,
            text: 'Applicant Distribution By Year',
          },
          legend: {
            labels: {
              color: '#ccc',
            },
          },
        },
        scales: {
          x: {
            display: true,
            stacked: true,
            title: {
              color: '#fff',
              display: true,
              text: 'Year',
            },
            ticks: {
              color: '#ccc',
            },
          },
          y: {
            display: true,
            title: {
              color: '#fff',
              display: true,
              text: 'Percentage',
            },
            ticks: {
              color: '#ccc',
            },
          },
        },
      },
    };
  }
}
