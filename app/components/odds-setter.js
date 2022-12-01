import Component from '@glimmer/component';
import { cached, tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { Simulation } from '../utils/monte-carlo';

function toFixed2(num) {
  return Math.round(num * 100) / 100;
}
// const ATTRITION = [0.52, 0.32, 0.24, 0.24, 0.24, 0.12, 0.08, 0.12];
const GROUP_SEED_DATA_2015 = [1427, 641, 281, 136, 57, 24];
const GROUP_SEED_DATA_2016 = [2233, 639, 377, 171, 71, 14, 5];
const GROUP_SEED_DATA_2017 = [2427, 1023, 397, 256, 112, 31, 2];
const GROUP_SEED_DATA_2018 = [2658, 1060, 668, 283, 161, 71, 8];
const GROUP_SEED_DATA_2019 = [3113, 1281, 697, 455, 191, 95, 30];
const GROUP_SEED_DATA_2020 = [3250, 1447, 914, 549, 315, 126, 54, 9];
const GROUP_SEED_DATA_2022 = [3318, 1063, 722, 514, 328, 186, 59, 18];
const GROUP_SEED_DATA_2023 = [3563, 1576, 733, 525, 373, 232, 126, 37, 5];
const DATA_SETS = {
  2015: GROUP_SEED_DATA_2015,
  2016: GROUP_SEED_DATA_2016,
  2017: GROUP_SEED_DATA_2017,
  2018: GROUP_SEED_DATA_2018,
  2019: GROUP_SEED_DATA_2019,
  2020: GROUP_SEED_DATA_2020,
  2022: GROUP_SEED_DATA_2022,
  2023: GROUP_SEED_DATA_2023,
};

class Group {
  @tracked applicants = 0;

  constructor(config) {
    Object.assign(this, config);
  }

  @cached
  get odds() {
    let odds = 1;
    let entries = this.ticketsPer;
    let ticketCount = this.year.totalTickets;
    let avgTickets = parseFloat(this.year.avgTickets);

    for (let i = 0; i < this.config.draws; i++) {
      let drawOdds = 1 - entries / (ticketCount - i * avgTickets);
      odds = odds * drawOdds;
    }

    return 1 - odds;
  }

  @cached
  get waitlistOdds() {
    let odds = 1;
    let entries = this.ticketsPer;
    let ticketCount = this.year.totalTickets;
    let avgTickets = parseFloat(this.year.avgTickets);
    const { draws, waitlistDraws } = this.config;

    for (let i = draws; i < draws + waitlistDraws; i++) {
      let drawOdds = 1 - entries / (ticketCount - i * avgTickets);
      odds = odds * drawOdds;
    }

    return 1 - odds;
  }

  @cached
  get combinedOdds() {
    let odds = 1;
    let entries = this.ticketsPer;
    let ticketCount = this.year.totalTickets;
    let avgTickets = parseFloat(this.year.avgTickets);
    const { draws, waitlistDraws } = this.config;

    for (let i = 0; i <= draws + waitlistDraws; i++) {
      let drawOdds = 1 - entries / (ticketCount - i * avgTickets);
      odds = odds * drawOdds;
    }

    return 1 - odds;
  }

  @cached
  get expectedEntrants() {
    let count = this.applicants;

    let selected = this.odds * count;
    // we can't know the distribution of who drops
    // so just doing the distribution of the original lottery
    // is best.
    // this.odds * count +
    // this.config.waitlistFactor * this.waitlistOdds * count;

    return Math.round(selected);
  }

  @cached
  get simulatedEntrants() {
    const { simulation } = this.year;
    const data = simulation
      ? simulation.count.find((v) => v.ticketsPer === this.ticketsPer)
      : null;
    return simulation ? data?.entered || 0 : 'N/A';
  }
}

class Year {
  @tracked year;
  @tracked isActual = false;
  @tracked hasSimulation = false;
  @tracked simulation = null;

  constructor(parentYear, config) {
    this.parent = parentYear || null;
    this.year = parentYear ? parentYear.year + 1 : config.startYear;
    this.config = config;
    this.isActual = DATA_SETS[this.year] !== undefined;
  }

  @action
  runSimulation() {
    this.hasSimulation = true;
    this.simulation = new Simulation(this);
  }

  @cached
  get groups() {
    let seeds;
    if (!this.isActual) {
      const groups = this.parent.groups;
      seeds = [Math.round(groups[0].applicants * this.config.growthRate)];
      this.parent.groups.forEach((group) => {
        let count = group.applicants;

        // adjust for selected
        let selected =
          group.simulatedEntrants !== 'N/A'
            ? group.simulatedEntrants
            : group.odds * count +
              this.config.waitlistFactor * group.waitlistOdds * count;
        count -= selected;

        if (count < 0) {
          count = 0;
        } else {
          count = Math.round(count);
        }

        if (count === 0) {
          return;
        }

        // adjust for dropouts
        const attrition =
          this.config.attrition[group.yearNo - 1] ||
          this.config.defaultAttrition;
        if (attrition !== undefined) {
          count = Math.round(count * (1 - attrition));
        }

        if (count === 0) {
          return;
        }

        seeds.push(count);
      });
    } else {
      seeds = DATA_SETS[this.year];
    }
    return seeds.map((applicants, yearIndex) => {
      const ticketsPer = this.isActual
        ? Math.pow(2, yearIndex)
        : this.config.formula(yearIndex);
      return new Group({
        applicants,
        yearNo: yearIndex + 1,
        ticketsPer,
        totalTickets: applicants * ticketsPer,
        year: this,
        config: this.config,
      });
    });
  }

  @cached
  get totalApplicants() {
    return Math.round(
      this.groups.reduce((v, g) => {
        return v + g.applicants;
      }, 0)
    );
  }

  @cached
  get expectedEntrants() {
    return Math.round(
      this.groups.reduce((v, g) => {
        return v + g.expectedEntrants;
      }, 0)
    );
  }

  @cached
  get simulatedEntrants() {
    const { simulation } = this;
    const data = simulation
      ? simulation.count.find((v) => v.ticketsPer === 'Total')
      : null;
    return simulation ? data?.entered || 0 : 'N/A';
  }

  @cached
  get _10PerOddsYear() {
    const odds = this.groups.find((g) => g.odds >= 0.1);
    if (!odds) {
      return this.groups.length + 1;
    }
    return odds.yearNo;
  }

  @cached
  get _25PerOddsYear() {
    const odds = this.groups.find((g) => g.odds >= 0.25);
    if (!odds) {
      return this.groups.length + 1;
    }
    return odds.yearNo;
  }

  @cached
  get _50PerOddsYear() {
    const odds = this.groups.find((g) => g.odds >= 0.5);
    if (!odds) {
      return this.groups.length + 1;
    }
    return odds.yearNo;
  }

  @cached
  get _75PerOddsYear() {
    const odds = this.groups.find((g) => g.odds >= 0.75);
    if (!odds) {
      return this.groups.length + 1;
    }
    return odds.yearNo;
  }

  @cached
  get totalTickets() {
    return Math.round(
      this.groups.reduce((v, g) => {
        return v + g.totalTickets;
      }, 0)
    );
  }

  @cached
  get avgTickets() {
    if (this.totalTickets === 0) {
      return '0';
    }
    return (this.totalTickets / this.totalApplicants).toFixed(1);
  }

  @cached
  get _avgYearsWeighted() {
    let numerator = 0;
    let denominator = 1;
    this.groups.forEach((g) => {
      let count = g.applicants;

      // adjust for selected
      let selected =
        g.odds * count + this.config.waitlistFactor * g.waitlistOdds * count;

      let weighted = selected * g.yearNo;

      numerator += weighted;
      denominator += selected;
    });

    return numerator / denominator;
  }

  @cached
  get avgYearsWeighted() {
    return this._avgYearsWeighted.toFixed(1);
  }
}

const datasets = Object.keys(DATA_SETS);
const newEntries = datasets.map((k) => DATA_SETS[k][0]);
let gr = 0;
let grc = 0;
for (let i = 1; i < newEntries.length; i++) {
  gr += (newEntries[i] - newEntries[i - 1]) / newEntries[i - 1];
  grc++;
}
const GROWTH_FACTOR = toFixed2(gr / grc);
const config = {
  growthRate: GROWTH_FACTOR,
  draws: 225,
  waitlistDraws: 50,
  waitlistFactor: 0.5,
  startYear: 2015,
  attrition: [],
  defaultAttrition: 0.2,
  formula: (n) => Math.pow(2, n),
};
const years = [];
let year = null;
for (let i = 0; i <= 8; i++) {
  year = new Year(year, config);
  if (year.year === 2021) {
    continue;
  }
  years.push(year);
}
let longest = 0;
const ATTRITIONS = datasets.map((key, index) => {
  if (index === 0) {
    return [];
  }
  let attritions = [];
  let prev = DATA_SETS[datasets[index - 1]];
  let curr = DATA_SETS[key];
  let prevYear = years[index - 1];
  for (let i = 1; i < curr.length; i++) {
    if (i > longest) {
      longest = i;
    }
    let prior = prev[i - 1];
    let retained = curr[i];
    let accepted = prevYear.groups[i - 1].expectedEntrants;
    attritions.push((prior - (retained + accepted)) / prior);
  }
  return attritions;
});
const ATTRITION = [];
for (let i = 0; i < longest; i++) {
  let total = 0;
  let count = 0;
  ATTRITIONS.forEach((val) => {
    if (val.length === 0) {
      return;
    }
    if (i >= val.length) {
      return;
    }
    total += val[i];
    count++;
  });
  ATTRITION.push(toFixed2(total / count));
}
const DRAWS = 275;
const WAITLIST_DRAWS = 75;
const WAITLIST_FACTOR = 0.5;
const DEFAULT_ATTRITION = 0.2;
const TOTAL_YEARS = 9;
const FORMULA = 'Math.pow(2, n)';

export default class extends Component {
  @tracked totalYears = TOTAL_YEARS;
  @tracked growthRate = GROWTH_FACTOR;
  @tracked draws = DRAWS;
  @tracked formula = FORMULA;
  @tracked finalizedFormula = new Function('n', 'return ' + FORMULA);
  @tracked waitlistDraws = WAITLIST_DRAWS;
  @tracked waitlistFactor = WAITLIST_FACTOR;
  @tracked attrition = ATTRITION.map(String).join(',');
  @tracked startYear = 2015;
  @tracked defaultAttrition = DEFAULT_ATTRITION;

  @action updateFormula(event) {
    this.formula = event.target.value;
  }

  @action persistFormula(event) {
    event.preventDefault();
    this.finalizedFormula = new Function('n', 'return ' + this.formula);
  }

  @action
  updateInt(prop, event) {
    event.preventDefault();
    this[prop] = parseInt(event.target.value);
  }

  @action updateFloat(prop, event) {
    event.preventDefault();
    this[prop] = parseFloat(event.target.value);
  }

  @action updateArr(prop, event) {
    this[prop] = event.target.value;
  }

  @action
  updateModel(event) {
    event.preventDefault();
  }

  @cached
  get model() {
    const {
      growthRate,
      draws,
      waitlistDraws,
      waitlistFactor,
      startYear,
      attrition,
      defaultAttrition,
      finalizedFormula,
    } = this;
    const config = {
      growthRate: 1 + growthRate,
      draws,
      waitlistDraws,
      waitlistFactor,
      startYear,
      attrition: attrition.split(',').map(parseFloat),
      defaultAttrition,
      formula: finalizedFormula,
    };
    const years = [];
    let year = null;
    for (let i = 0; i <= this.totalYears; i++) {
      year = new Year(year, config);
      if (year.year === 2021) {
        continue;
      }
      years.push(year);
    }
    return years;
  }

  @cached
  get reversed() {
    return this.model.slice().reverse();
  }
}
