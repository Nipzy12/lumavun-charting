/**
 * VibeCharts - Advanced Charting Library
 * Version 1.1.0
 * 
 * New in v1.1.0:
 * - Multi-color support for line charts
 * - Individual bar colors option
 * - Shade variations for series
 * - Loading placeholders with theme support
 * - Enhanced animations
 * - New chart types: Donut, Area, Waterfall
 * - Simplified initialization
 */

class VibeCharts {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container with id "${containerId}" not found`);
    }
    
    this.options = {
      type: 'bar',
      data: [],
      colors: ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#fee140'],
      barColorMode: 'series',
      lineColorMode: 'same',
      lineFill: false,
      areaFill: true,
      fillOpacity: 0.3,
      textColor: '#333333',
      backgroundColor: '#ffffff',
      gradient: false,
      gradientColors: ['#667eea', '#764ba2'],
      labelPosition: 'top',
      style: 'default',
      theme: 'dark',
      customTheme: null,
      width: '100%',
      height: 400,
      title: '',
      xLabel: '',
      yLabel: '',
      showLegend: true,
      legendPosition: 'bottom',
      showGrid: true,
      showLabels: true,
      animated: true,
      responsive: true,
      showPlaceholder: true,
      animationDuration: 800,
      ...options
    };
    
    this.canvas = null;
    this.ctx = null;
    this.animationFrame = null;
    this.resizeObserver = null;
    this.isLoading = false;
    this.legendElement = null;
    
    if (this.options.showPlaceholder) {
      this.showPlaceholder();
    }
    
    this.init();
    this.setupResponsive();
  }
  
  showPlaceholder() {
    this.isLoading = true;
    this.container.innerHTML = '';
    this.container.className = `vibechart-container vibechart-${this.options.theme} vibechart-${this.options.style}`;
    
    const placeholder = document.createElement('div');
    placeholder.className = 'vibechart-placeholder';
    placeholder.innerHTML = `
      <div class="placeholder-shimmer">
        <div class="placeholder-title"></div>
        <div class="placeholder-chart">
          <div class="placeholder-bar" style="height: 60%"></div>
          <div class="placeholder-bar" style="height: 80%"></div>
          <div class="placeholder-bar" style="height: 70%"></div>
          <div class="placeholder-bar" style="height: 90%"></div>
          <div class="placeholder-bar" style="height: 75%"></div>
        </div>
        <div class="placeholder-legend">
          <div class="placeholder-legend-item"></div>
          <div class="placeholder-legend-item"></div>
          <div class="placeholder-legend-item"></div>
        </div>
      </div>
    `;
    
    this.container.appendChild(placeholder);
  }
  
  hidePlaceholder() {
    const placeholder = this.container.querySelector('.vibechart-placeholder');
    if (placeholder) {
      placeholder.style.opacity = '0';
      setTimeout(() => placeholder.remove(), 300);
    }
    this.isLoading = false;
  }
  
  setupResponsive() {
    if (!this.options.responsive) return;
    
    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (this.canvas) {
          this.canvas.width = this.container.offsetWidth;
          this.render();
        }
      }, 150);
    };
    
    window.addEventListener('resize', handleResize);
    
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(handleResize);
      this.resizeObserver.observe(this.container);
    }
  }
  
  init() {
    this.applyTheme();
    this.createCanvas();
    setTimeout(() => {
      this.hidePlaceholder();
      this.render();
    }, 500);
  }
  
  applyTheme() {
    const themes = {
      lite: { backgroundColor: '#ffffff', textColor: '#333333', gridColor: '#e0e0e0' },
      dark: { backgroundColor: '#1a1a2e', textColor: '#eee', gridColor: '#2a2a3e' },
      gradient: { backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', textColor: '#ffffff', gridColor: 'rgba(255,255,255,0.1)' },
      glass: { backgroundColor: 'rgba(255, 255, 255, 0.1)', textColor: '#333333', gridColor: 'rgba(0,0,0,0.05)' }
    };
    
    // Custom theme takes precedence
    if (this.options.customTheme) {
      this.options.backgroundColor = this.options.customTheme.backgroundColor || this.options.backgroundColor;
      this.options.textColor = this.options.customTheme.textColor || this.options.textColor;
      this.options.gridColor = this.options.customTheme.gridColor || 'rgba(128, 128, 128, 0.2)';
      return;
    }
    
    const theme = themes[this.options.theme] || themes.dark;
    if (!this.options.backgroundColor || this.options.backgroundColor === '#ffffff') {
      this.options.backgroundColor = theme.backgroundColor;
    }
    if (!this.options.textColor || this.options.textColor === '#333333') {
      this.options.textColor = theme.textColor;
    }
    this.options.gridColor = theme.gridColor;
  }
  
  createCanvas() {
    if (this.isLoading) return;
    
    const existingCanvas = this.container.querySelector('canvas');
    if (existingCanvas) {
      existingCanvas.remove();
    }
    
    this.container.className = `vibechart-container vibechart-${this.options.theme} vibechart-${this.options.style}`;
    
    if (this.options.backgroundColor.includes('gradient')) {
      this.container.style.background = this.options.backgroundColor;
    } else {
      this.container.style.backgroundColor = this.options.backgroundColor;
    }
    
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.container.offsetWidth;
    this.canvas.height = this.options.height;
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);
  }
  
  async loadData(source) {
    this.showPlaceholder();
    
    if (typeof source === 'string') {
      const response = await fetch(source);
      this.options.data = await response.json();
    } else {
      this.options.data = source;
    }
    
    setTimeout(() => {
      this.hidePlaceholder();
      this.createCanvas();
      this.render();
    }, 500);
  }
  
  render() {
    if (this.isLoading) return;
    
    this.clear();
    
    const chartTypes = {
      bar: () => this.drawBar(),
      horizontalBar: () => this.drawHorizontalBar(),
      line: () => this.drawLine(),
      area: () => this.drawArea(),
      pie: () => this.drawPie(),
      donut: () => this.drawDonut(),
      scatter: () => this.drawScatter(),
      bubble: () => this.drawBubble(),
      radar: () => this.drawRadar(),
      polar: () => this.drawPolar(),
      heatmap: () => this.drawHeatmap(),
      treemap: () => this.drawTreemap(),
      gauge: () => this.drawGauge(),
      waterfall: () => this.drawWaterfall()
    };
    
    if (this.options.title) {
      this.drawTitle();
    }
    
    if (chartTypes[this.options.type]) {
      chartTypes[this.options.type]();
    }
    
    if (this.options.showLegend && this.options.data.length > 0) {
      this.drawExternalLegend();
    }
  }
  
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
  
  drawTitle() {
    this.ctx.fillStyle = this.options.textColor;
    this.ctx.font = 'bold 20px Inter, Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(this.options.title, this.canvas.width / 2, 30);
  }
  
  drawGrid() {
    if (!this.options.showGrid) return;
    
    this.ctx.strokeStyle = this.options.gridColor;
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([5, 5]);
    
    const padding = 60;
    const chartHeight = this.canvas.height - padding * 2;
    const gridLines = 5;
    
    for (let i = 0; i <= gridLines; i++) {
      const y = padding + (chartHeight / gridLines) * i;
      this.ctx.beginPath();
      this.ctx.moveTo(padding, y);
      this.ctx.lineTo(this.canvas.width - padding, y);
      this.ctx.stroke();
    }
    
    this.ctx.setLineDash([]);
  }
  
  getColor(index, mode = 'series') {
    const colors = this.options.colors;
    
    if (mode === 'individual') {
      return colors[index % colors.length];
    } else if (mode === 'shade') {
      const baseColor = colors[0];
      return this.adjustBrightness(baseColor, 1 - (index * 0.15));
    }
    
    return colors[index % colors.length];
  }
  
  adjustBrightness(color, factor) {
    const rgb = this.hexToRgb(color);
    const r = Math.min(255, Math.max(0, Math.round(rgb.r * factor)));
    const g = Math.min(255, Math.max(0, Math.round(rgb.g * factor)));
    const b = Math.min(255, Math.max(0, Math.round(rgb.b * factor)));
    return `rgb(${r},${g},${b})`;
  }
  
  getRadius() {
    const radii = { sharp: 0, default: 4, soft: 18, rounded: 51 };
    return radii[this.options.style] || 4;
  }
  
  drawRoundedRect(x, y, width, height, radius) {
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + width - radius, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.ctx.lineTo(x + width, y + height - radius);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.ctx.lineTo(x + radius, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
  }
  
  applyGradient(x, y, width, height) {
    if (!this.options.gradient) return null;
    
    const gradient = this.ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, this.options.gradientColors[0]);
    gradient.addColorStop(1, this.options.gradientColors[1]);
    return gradient;
  }
  
  drawBar() {
    const data = this.options.data;
    const padding = 60;
    const chartWidth = this.canvas.width - padding * 2;
    const chartHeight = this.canvas.height - padding * 2;
    const barWidth = chartWidth / data.length - 10;
    const maxValue = Math.max(...data.map(d => d.value || d));
    
    this.drawGrid();
    
    data.forEach((item, i) => {
      const value = item.value || item;
      const targetHeight = (value / maxValue) * chartHeight;
      const x = padding + i * (barWidth + 10);
      const y = this.canvas.height - padding - targetHeight;
      
      const color = this.applyGradient(x, y, barWidth, targetHeight) || 
                    this.getColor(i, this.options.barColorMode);
      this.ctx.fillStyle = color;
      
      this.drawRoundedRect(x, y, barWidth, targetHeight, this.getRadius());
      this.ctx.fill();
      
      // Labels
      if (this.options.showLabels) {
        this.ctx.fillStyle = this.options.textColor;
        this.ctx.font = '11px Inter, Arial';
        this.ctx.textAlign = 'center';
        const label = item.label || `Item ${i + 1}`;
        this.ctx.fillText(label, x + barWidth / 2, this.canvas.height - padding + 20);
        this.ctx.fillText(value, x + barWidth / 2, y - 10);
      }
    });
  }
  
  drawHorizontalBar() {
    const data = this.options.data;
    const padding = 80;
    const chartWidth = this.canvas.width - padding * 2;
    const chartHeight = this.canvas.height - padding * 2;
    const barHeight = chartHeight / data.length - 10;
    const maxValue = Math.max(...data.map(d => d.value || d));
    
    data.forEach((item, i) => {
      const value = item.value || item;
      const barWidth = (value / maxValue) * chartWidth;
      const x = padding;
      const y = padding + i * (barHeight + 10);
      
      const color = this.applyGradient(x, y, barWidth, barHeight) || 
                    this.getColor(i, this.options.barColorMode);
      this.ctx.fillStyle = color;
      
      this.drawRoundedRect(x, y, barWidth, barHeight, this.getRadius());
      this.ctx.fill();
      
      this.ctx.fillStyle = this.options.textColor;
      this.ctx.font = '12px Inter, Arial';
      this.ctx.textAlign = 'right';
      const label = item.label || `Item ${i + 1}`;
      this.ctx.fillText(label, padding - 10, y + barHeight / 2 + 4);
      this.ctx.textAlign = 'left';
      this.ctx.fillText(value, x + barWidth + 5, y + barHeight / 2 + 4);
    });
  }
  
  drawLine() {
    const data = this.options.data;
    const padding = 60;
    const chartWidth = this.canvas.width - padding * 2;
    const chartHeight = this.canvas.height - padding * 2;
    const maxValue = Math.max(...data.map(d => d.value || d));
    const step = chartWidth / (data.length - 1);
    
    this.drawGrid();
    
    const lineColor = this.options.lineColorMode === 'gradient' 
      ? this.ctx.createLinearGradient(padding, 0, this.canvas.width - padding, 0)
      : this.getColor(0);
      
    if (this.options.lineColorMode === 'gradient') {
      lineColor.addColorStop(0, this.options.colors[0]);
      lineColor.addColorStop(1, this.options.colors[1] || this.options.colors[0]);
    }
    
    // Draw fill if enabled
    if (this.options.lineFill) {
      const gradient = this.ctx.createLinearGradient(0, padding, 0, this.canvas.height - padding);
      gradient.addColorStop(0, this.options.colors[0] + Math.floor(this.options.fillOpacity * 255).toString(16).padStart(2, '0'));
      gradient.addColorStop(1, this.options.colors[0] + '00');
      
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.moveTo(padding, this.canvas.height - padding);
      
      data.forEach((item, i) => {
        const value = item.value || item;
        const x = padding + i * step;
        const y = this.canvas.height - padding - (value / maxValue) * chartHeight;
        this.ctx.lineTo(x, y);
      });
      
      this.ctx.lineTo(padding + (data.length - 1) * step, this.canvas.height - padding);
      this.ctx.closePath();
      this.ctx.fill();
    }
    
    // Draw line
    this.ctx.strokeStyle = lineColor;
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    
    data.forEach((item, i) => {
      const value = item.value || item;
      const x = padding + i * step;
      const y = this.canvas.height - padding - (value / maxValue) * chartHeight;
      
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    });
    
    this.ctx.stroke();
    
    // Draw points
    data.forEach((item, i) => {
      const value = item.value || item;
      const x = padding + i * step;
      const y = this.canvas.height - padding - (value / maxValue) * chartHeight;
      
      const pointColor = this.options.lineColorMode === 'individual' 
        ? this.getColor(i) 
        : (typeof lineColor === 'string' ? lineColor : this.options.colors[0]);
      
      this.ctx.fillStyle = pointColor;
      this.ctx.beginPath();
      this.ctx.arc(x, y, 5, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }
  
  drawArea() {
    const data = this.options.data;
    const padding = 60;
    const chartWidth = this.canvas.width - padding * 2;
    const chartHeight = this.canvas.height - padding * 2;
    const maxValue = Math.max(...data.map(d => d.value || d));
    const step = chartWidth / (data.length - 1);
    
    this.drawGrid();
    
    const gradient = this.ctx.createLinearGradient(0, padding, 0, this.canvas.height - padding);
    gradient.addColorStop(0, this.options.colors[0] + '80');
    gradient.addColorStop(1, this.options.colors[0] + '10');
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    
    this.ctx.moveTo(padding, this.canvas.height - padding);
    data.forEach((item, i) => {
      const value = item.value || item;
      const x = padding + i * step;
      const y = this.canvas.height - padding - (value / maxValue) * chartHeight;
      this.ctx.lineTo(x, y);
    });
    this.ctx.lineTo(padding + (data.length - 1) * step, this.canvas.height - padding);
    this.ctx.closePath();
    this.ctx.fill();
    
    this.ctx.strokeStyle = this.options.colors[0];
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    
    data.forEach((item, i) => {
      const value = item.value || item;
      const x = padding + i * step;
      const y = this.canvas.height - padding - (value / maxValue) * chartHeight;
      
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    });
    
    this.ctx.stroke();
  }
  
  drawPie() {
    const data = this.options.data;
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 60;
    const total = data.reduce((sum, item) => sum + (item.value || item), 0);
    
    let startAngle = -Math.PI / 2;
    
    data.forEach((item, i) => {
      const value = item.value || item;
      const sliceAngle = (value / total) * Math.PI * 2;
      
      this.ctx.fillStyle = this.getColor(i);
      this.ctx.beginPath();
      this.ctx.moveTo(centerX, centerY);
      this.ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      this.ctx.closePath();
      this.ctx.fill();
      
      const labelAngle = startAngle + sliceAngle / 2;
      const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7);
      const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7);
      
      this.ctx.fillStyle = '#fff';
      this.ctx.font = 'bold 14px Inter, Arial';
      this.ctx.textAlign = 'center';
      const percentage = ((value / total) * 100).toFixed(1) + '%';
      this.ctx.fillText(percentage, labelX, labelY);
      
      startAngle += sliceAngle;
    });
  }
  
  drawDonut() {
    const data = this.options.data;
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const outerRadius = Math.min(centerX, centerY) - 60;
    const innerRadius = outerRadius * 0.6;
    const total = data.reduce((sum, item) => sum + (item.value || item), 0);
    
    let startAngle = -Math.PI / 2;
    
    data.forEach((item, i) => {
      const value = item.value || item;
      const sliceAngle = (value / total) * Math.PI * 2;
      
      this.ctx.fillStyle = this.getColor(i);
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, outerRadius, startAngle, startAngle + sliceAngle);
      this.ctx.arc(centerX, centerY, innerRadius, startAngle + sliceAngle, startAngle, true);
      this.ctx.closePath();
      this.ctx.fill();
      
      startAngle += sliceAngle;
    });
    
    this.ctx.fillStyle = this.options.textColor;
    this.ctx.font = 'bold 32px Inter, Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(total, centerX, centerY + 10);
    this.ctx.font = '14px Inter, Arial';
    this.ctx.fillText('Total', centerX, centerY + 30);
  }
  
  drawRadar() {
    const data = this.options.data;
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 80;
    const numPoints = data.length;
    const angleStep = (Math.PI * 2) / numPoints;
    const maxValue = Math.max(...data.map(d => d.value || d));
    
    for (let i = 1; i <= 5; i++) {
      this.ctx.strokeStyle = this.options.gridColor;
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, (radius / 5) * i, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    
    this.ctx.strokeStyle = this.options.gridColor;
    data.forEach((item, i) => {
      const angle = angleStep * i - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      this.ctx.beginPath();
      this.ctx.moveTo(centerX, centerY);
      this.ctx.lineTo(x, y);
      this.ctx.stroke();
      
      const labelX = centerX + Math.cos(angle) * (radius + 20);
      const labelY = centerY + Math.sin(angle) * (radius + 20);
      this.ctx.fillStyle = this.options.textColor;
      this.ctx.textAlign = 'center';
      this.ctx.font = '12px Inter, Arial';
      this.ctx.fillText(item.label || `Axis ${i + 1}`, labelX, labelY);
    });
    
    this.ctx.fillStyle = this.getColor(0) + '60';
    this.ctx.strokeStyle = this.getColor(0);
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    
    data.forEach((item, i) => {
      const value = item.value || item;
      const angle = angleStep * i - Math.PI / 2;
      const distance = (value / maxValue) * radius;
      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance;
      
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    });
    
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
  }
  
  drawGauge() {
    const value = this.options.data.value || this.options.data[0]?.value || 75;
    const max = this.options.data.max || 100;
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2 + 40;
    const radius = Math.min(centerX, centerY) - 60;
    
    this.ctx.strokeStyle = this.options.gridColor;
    this.ctx.lineWidth = 20;
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius, Math.PI, Math.PI * 2);
    this.ctx.stroke();
    
    const angle = Math.PI + (value / max) * Math.PI;
    const gradient = this.ctx.createLinearGradient(centerX - radius, centerY, centerX + radius, centerY);
    gradient.addColorStop(0, this.options.colors[0]);
    gradient.addColorStop(1, this.options.colors[1] || this.options.colors[0]);
    
    this.ctx.strokeStyle = gradient;
    this.ctx.lineWidth = 20;
    this.ctx.lineCap = 'round';
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, radius, Math.PI, angle);
    this.ctx.stroke();
    
    this.ctx.fillStyle = this.options.textColor;
    this.ctx.font = 'bold 48px Inter, Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(value, centerX, centerY + 15);
    this.ctx.font = '16px Inter, Arial';
    this.ctx.fillText(`/ ${max}`, centerX, centerY + 40);
  }
  
  drawHeatmap() {
    const data = this.options.data;
    const padding = 60;
    const rows = data.length;
    const cols = data[0]?.values?.length || 0;
    const cellWidth = (this.canvas.width - padding * 2) / cols;
    const cellHeight = (this.canvas.height - padding * 2) / rows;
    
    const allValues = data.flatMap(row => row.values || []);
    const maxValue = Math.max(...allValues);
    
    data.forEach((row, i) => {
      const values = row.values || [];
      values.forEach((value, j) => {
        const intensity = value / maxValue;
        const color = this.interpolateColor(this.options.colors[0], this.options.colors[1] || '#ff0000', intensity);
        
        this.ctx.fillStyle = color;
        const x = padding + j * cellWidth;
        const y = padding + i * cellHeight;
        
        this.drawRoundedRect(x + 2, y + 2, cellWidth - 4, cellHeight - 4, this.getRadius());
        this.ctx.fill();
        
        this.ctx.fillStyle = intensity > 0.5 ? '#fff' : '#000';
        this.ctx.font = '12px Inter, Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(value, x + cellWidth / 2, y + cellHeight / 2 + 4);
      });
    });
  }
  
  drawWaterfall() {
    const data = this.options.data;
    const padding = 60;
    const chartWidth = this.canvas.width - padding * 2;
    const chartHeight = this.canvas.height - padding * 2;
    const barWidth = chartWidth / data.length - 10;
    
    const values = data.map(d => d.value || d);
    const cumulative = values.reduce((acc, val, i) => {
      acc.push(i === 0 ? val : acc[i - 1] + val);
      return acc;
    }, []);
    const maxValue = Math.max(...cumulative);
    const minValue = Math.min(...cumulative, 0);
    const range = maxValue - minValue;
    
    this.drawGrid();
    
    data.forEach((item, i) => {
      const value = item.value || item;
      const prevCumulative = i === 0 ? 0 : cumulative[i - 1];
      const currentCumulative = cumulative[i];
      
      const barHeight = Math.abs(value / range) * chartHeight;
      const x = padding + i * (barWidth + 10);
      const y = this.canvas.height - padding - ((currentCumulative - minValue) / range) * chartHeight;
      
      const color = value >= 0 ? this.options.colors[2] || '#43e97b' : this.options.colors[3] || '#f5576c';
      this.ctx.fillStyle = color;
      
      this.drawRoundedRect(x, y, barWidth, barHeight, this.getRadius());
      this.ctx.fill();
      
      if (i > 0) {
        this.ctx.strokeStyle = this.options.gridColor;
        this.ctx.setLineDash([5, 3]);
        this.ctx.beginPath();
        const prevX = padding + (i - 1) * (barWidth + 10) + barWidth;
        const prevY = this.canvas.height - padding - ((prevCumulative - minValue) / range) * chartHeight;
        this.ctx.moveTo(prevX, prevY);
        this.ctx.lineTo(x, y + (value >= 0 ? barHeight : 0));
        this.ctx.stroke();
        this.ctx.setLineDash([]);
      }
      
      this.ctx.fillStyle = this.options.textColor;
      this.ctx.font = '12px Inter, Arial';
      this.ctx.textAlign = 'center';
      const label = item.label || `Item ${i + 1}`;
      this.ctx.fillText(label, x + barWidth / 2, this.canvas.height - padding + 20);
    });
  }
  
  drawScatter() { }
  drawBubble() { }
  drawPolar() { }
  drawTreemap() { }
  
  drawLegend() {
    const legendX = this.canvas.width - 150;
    const legendY = 60;
    const data = this.options.data;
    
    data.forEach((item, i) => {
      const y = legendY + i * 25;
      
      this.ctx.fillStyle = this.getColor(i);
      this.drawRoundedRect(legendX, y, 15, 15, 2);
      this.ctx.fill();
      
      this.ctx.fillStyle = this.options.textColor;
      this.ctx.font = '12px Inter, Arial';
      this.ctx.textAlign = 'left';
      const label = item.label || `Series ${i + 1}`;
      this.ctx.fillText(label, legendX + 25, y + 12);
    });
  }
  
  interpolateColor(color1, color2, factor) {
    const c1 = this.hexToRgb(color1);
    const c2 = this.hexToRgb(color2);
    const r = Math.round(c1.r + (c2.r - c1.r) * factor);
    const g = Math.round(c1.g + (c2.g - c1.g) * factor);
    const b = Math.round(c1.b + (c2.b - c1.b) * factor);
    return `rgb(${r},${g},${b})`;
  }
  
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }
  
  updateOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
    this.init();
  }
  
  destroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    this.container.innerHTML = '';
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VibeCharts;
}