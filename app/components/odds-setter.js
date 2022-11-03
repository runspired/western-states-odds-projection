import Component from '@glimmer/component';
import { cached, tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

const GROWTH_FACTOR = 0.15;
const ATTRITION = [0.67, 0.3, 0.25, 0.25, 0.31, 0.5, 0.08];
const GROUP_SEED_DATA_2015 = [1427, 641, 281, 136, 57, 24];
const GROUP_SEED_DATA_2016 = [2233, 639, 377, 171, 71, 14, 5];
const GROUP_SEED_DATA_2017 = [2427, 1023, 397, 256, 112, 31, 2];
const GROUP_SEED_DATA_2018 = [2658, 1060, 668, 283, 161, 71, 8];
const GROUP_SEED_DATA_2019 = [3113, 1281, 697, 455, 191, 95, 30];
const GROUP_SEED_DATA_2020 = [3250, 1447, 914, 549, 315, 126, 54, 9];
const GROUP_SEED_DATA_2022 = [3318, 1063, 722, 514, 328, 186, 59, 18];
// const GROUP_SEED_DATA_2023 = [2180, 1001, 506, 358, 241, 163, 92, 27, 5];
const DATA_SETS = {
  2015: GROUP_SEED_DATA_2015,
  2016: GROUP_SEED_DATA_2016,
  2017: GROUP_SEED_DATA_2017,
  2018: GROUP_SEED_DATA_2018,
  2019: GROUP_SEED_DATA_2019,
  2020: GROUP_SEED_DATA_2020,
  2022: GROUP_SEED_DATA_2022,
  // 2023: GROUP_SEED_DATA_2023,
};
const DRAWS = 250;
const WAITLIST_DRAWS = 75;
const WAITLIST_FACTOR = 0.5;
const DEFAULT_ATTRITION = 0.2;
const TOTAL_YEARS = 25;

class Group {
  constructor(config) {
    Object.assign(this, config);
  }

  @cached
  get odds() {
    let odds = 1;
    let entries = this.ticketsPer;
    let ticketCount = this.year.totalTickets;
    let avgTickets = parseFloat(this.year.avgTickets);

    for (let i = 1; i <= this.config.draws; i++) {
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
    let avgTickets = this.year.avgTickets;
    const { draws, waitlistDraws } = this.config;

    for (let i = draws + 1; i <= draws + waitlistDraws; i++) {
      let drawOdds = 1 - entries / (ticketCount - i * avgTickets);
      odds = odds * drawOdds;
    }

    return 1 - odds;
  }

  @cached
  get combinedOdds() {
    return this.odds + this.waitlistOdds;
  }

  @cached
  get expectedEntrants() {
    let count = this.applicants;

    // adjust for selected
    let selected =
      this.odds * count +
      this.config.waitlistFactor * this.waitlistOdds * count;

    return Math.round(selected);
  }
}

class Year {
  @tracked year;
  @tracked isActual = false;

  constructor(parentYear, config) {
    this.parent = parentYear || null;
    this.year = parentYear ? parentYear.year + 1 : config.startYear;
    this.config = config;
    this.isActual = DATA_SETS[this.year] !== undefined;
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
          group.odds * count +
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
      const ticketsPer = Math.pow(2, yearIndex);
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
  get _10PerOddsYear() {
    return this.groups.find((g) => g.odds >= 0.1).yearNo;
  }

  @cached
  get _25PerOddsYear() {
    return this.groups.find((g) => g.odds >= 0.25).yearNo;
  }

  @cached
  get _50PerOddsYear() {
    const odds = this.groups.find((g) => g.odds >= 0.5);
    if (!odds) {
      return this.groups.length + 2;
    }
    return odds.yearNo;
  }

  @cached
  get _75PerOddsYear() {
    const odds = this.groups.find((g) => g.odds >= 0.75);
    if (!odds) {
      return this.groups.length + 2;
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
  get avgYearsWeighted() {
    let numerator = 0;
    let denominator = 1;
    this.groups.forEach((g) => {
      let count = g.applicants;

      // adjust for selected
      let selected =
        g.odds * count + this.config.waitlistFactor * g.waitlistOdds * count;

      let weighted = selected * g.yearNo;
      console.log({
        yearNo: g.yearNo,
        weighted,
        selected,
      });
      numerator += weighted;
      denominator += selected;
    });
    console.log({
      numerator,
      denominator,
    });
    return (numerator / denominator).toFixed(1);
  }
}

export default class extends Component {
  @tracked totalYears = TOTAL_YEARS;
  @tracked growthRate = GROWTH_FACTOR;
  @tracked draws = DRAWS;
  @tracked waitlistDraws = WAITLIST_DRAWS;
  @tracked waitlistFactor = WAITLIST_FACTOR;
  @tracked attrition = ATTRITION.map(String).join(',');
  @tracked startYear = 2015;
  @tracked defaultAttrition = DEFAULT_ATTRITION;

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
    } = this;
    const config = {
      growthRate: 1 + growthRate,
      draws,
      waitlistDraws,
      waitlistFactor,
      startYear,
      attrition: attrition.split(',').map(parseFloat),
      defaultAttrition,
    };
    const years = [];
    let year = null;
    for (let i = 0; i <= this.totalYears; i++) {
      year = new Year(year, config);
      years.push(year);
    }
    return years;
  }
}
