import Modifier from 'ember-modifier';
import { registerDestructor } from '@ember/destroyable';

import {
  BarElement,
  Chart,
  LineElement,
  PointElement,
  LineController,
  CategoryScale,
  LinearScale,
  Filler,
  Legend,
  Title,
  Tooltip,
  SubTitle,
  BarController,
} from 'chart.js';

Chart.register(
  BarElement,
  LineElement,
  PointElement,
  LineController,
  CategoryScale,
  LinearScale,
  Filler,
  Legend,
  Title,
  Tooltip,
  SubTitle,
  BarController
);

function cleanup(mod) {
  return mod.chart.destroy();
}

export default class extends Modifier {
  chart = null;

  constructor(owner, args) {
    super(owner, args);
    registerDestructor(this, cleanup);
  }

  modify(element, [config]) {
    const { chart } = this;
    if (!chart) {
      this.chart = new Chart(element, config);
    } else {
      chart.data = config.data;
      chart.update();
    }
  }
}
