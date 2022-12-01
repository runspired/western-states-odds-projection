import Component from '@glimmer/component';
import { cached } from '@glimmer/tracking';

function getRandom255() {
  return Math.round(Math.random() * 150) + 105;
}
function getRandomChannel() {
  return Math.round(Math.random() * 3) + 1;
}

function generateColor() {
  const color = getRandom255();
  const rgb = [
    getRandomChannel() === 1 ? 0 : color,
    getRandomChannel() === 1 ? 0 : color,
    getRandomChannel() === 1 ? 0 : color,
  ];
  const a = (Math.random() * 0.8 + 0.2).toFixed(2);
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
}

export default class extends Component {
  @cached
  get config() {
    const colors = [
      // new Array(6).fill(null).map(generateColor);
      'rgba(200, 200, 200, .2)',
      'rgba(255, 255, 255, 0.8)',
      'rgba(255, 0, 255, 0.8)',
      'rgba(255, 255, 0, 0.8)',
      'rgba(0, 255, 255, 0.8)',
      'rgba(0, 255, 0, 0.8)',
      'rgba(100, 200, 255, 0.8)',
    ];
    return {
      data: {
        labels: this.args.model.map((y) => y.year),
        datasets: [
          {
            type: 'bar',
            label: 'Total Tickets By Year',
            data: this.args.model.map((y) => y.totalTickets),
            borderColor: colors[0],
            backgroundColor: colors[0],
            fill: true,
            borderWidth: 1,
            pointStyle: 'circle',
            radius: 1,
          },
          {
            type: 'bar',
            label: 'Total Applicants',
            data: this.args.model.map((y) => y.totalApplicants),
            borderColor: colors[6],
            backgroundColor: colors[6],
            fill: true,
            borderWidth: 1,
            pointStyle: 'circle',
            radius: 1,
          },
          {
            type: 'line',
            label: 'Average Years In Lottery For Entrant',
            data: this.args.model.map((y) => y.avgYearsWeighted),
            borderColor: colors[1],
            backgroundColor: colors[1],
            fill: false,
            borderWidth: 2,
            pointStyle: 'circle',
            radius: 2,
            yAxisID: 'y1',
          },
          {
            type: 'line',
            label: 'Years To 10% Odds',
            data: this.args.model.map((y) => y._10PerOddsYear),
            borderColor: colors[2],
            backgroundColor: colors[2],
            fill: false,
            borderWidth: 1,
            pointStyle: 'circle',
            radius: 2,
            yAxisID: 'y1',
          },
          {
            type: 'line',
            label: 'Years To 25% Odds',
            data: this.args.model.map((y) => y._25PerOddsYear),
            borderColor: colors[3],
            backgroundColor: colors[3],
            fill: false,
            borderWidth: 1,
            pointStyle: 'circle',
            radius: 2,
            yAxisID: 'y1',
          },

          {
            type: 'line',
            label: 'Years To 50% Odds',
            data: this.args.model.map((y) => y._50PerOddsYear),
            borderColor: colors[4],
            backgroundColor: colors[4],
            fill: false,
            borderWidth: 1,
            pointStyle: 'circle',
            radius: 2,
            yAxisID: 'y1',
          },
          {
            type: 'line',
            label: 'Years To 75% Odds',
            data: this.args.model.map((y) => y._75PerOddsYear),
            borderColor: colors[5],
            backgroundColor: colors[5],
            fill: false,
            borderWidth: 1,
            pointStyle: 'circle',
            radius: 2,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            color: '#fff',
            display: true,
            text: 'Applicant Ticket Count By Year',
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
              text: 'Tickets',
            },
            ticks: {
              color: '#ccc',
            },
          },
          y1: {
            display: true,
            position: 'right',
            title: {
              color: '#fff',
              display: true,
              text: 'Years',
            },
            ticks: {
              color: '#ccc',
            },
          },
        },
      },
    };
  }

  @cached
  get isReady() {
    const latest = this.args.model.at(-1);
    return (
      !latest.config.useMonteCarlo || Boolean(latest.simulation?.isComplete)
    );
  }
}
