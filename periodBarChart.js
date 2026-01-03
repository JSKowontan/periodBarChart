(function() {
    "use strict";

    // =================================================================================
    // PART 1: BUILDER PANEL (Design Time Configuration)
    // =================================================================================
    
    const builderTemplate = document.createElement("template");
    builderTemplate.innerHTML = `
        <style>
            :host {
                display: block;
                padding: 15px;
                font-family: "72", "Segoe UI", Arial, sans-serif;
                background-color: #fafafa;
                height: 100%;
                box-sizing: border-box;
            }
            .form-group {
                margin-bottom: 20px;
                border-bottom: 1px solid #e5e5e5;
                padding-bottom: 15px;
            }
            .form-group:last-child {
                border-bottom: none;
            }
            label {
                display: block;
                margin-bottom: 8px;
                font-size: 12px;
                font-weight: bold;
                color: #333;
            }
            .hint {
                font-size: 11px;
                color: #666;
                margin-top: 4px;
                font-style: italic;
            }
            
            /* Inputs */
            input[type="text"] {
                width: 100%;
                padding: 8px;
                border: 1px solid #ccc;
                border-radius: 4px;
                box-sizing: border-box;
                font-size: 13px;
            }
            input[type="color"] {
                width: 100%;
                height: 40px;
                border: 1px solid #ccc;
                border-radius: 4px;
                cursor: pointer;
            }

            /* Range Slider */
            .slider-container {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            input[type="range"] {
                flex: 1;
            }
            .slider-value {
                font-size: 12px;
                color: #555;
                min-width: 35px;
                text-align: right;
            }
            
            /* Toggle Switch */
            .toggle-container {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            input[type="checkbox"] {
                transform: scale(1.2);
            }
        </style>

        <form id="form">
            <!-- 1. Measure Name -->
            <div class="form-group">
                <label for="measureName">Measure Name</label>
                <input type="text" id="measureName" value="Revenue">
                <div class="hint">Displayed in the tooltip (e.g., 'Gross Profit').</div>
            </div>

            <!-- 2. Bar Color -->
            <div class="form-group">
                <label for="barColor">Bar Color</label>
                <input type="color" id="barColor" value="#d3d3d3">
                <div class="hint">Default is Light Gray.</div>
            </div>

            <!-- 3. Bar Width Slider -->
            <div class="form-group">
                <label for="barWidth">Bar Width</label>
                <div class="slider-container">
                    <input type="range" id="barWidth" min="1" max="90" value="20">
                    <span class="slider-value" id="barWidthVal">20%</span>
                </div>
                <div class="hint">Adjust thickness (Sparkline vs Bar Chart).</div>
            </div>

            <!-- 4. Axis Labels -->
            <div class="form-group">
                <div class="toggle-container">
                    <input type="checkbox" id="showLabels">
                    <label for="showLabels" style="margin:0">Show Axis Labels</label>
                </div>
            </div>
            
            <!-- Hidden submit for standard form behavior prevention -->
            <input type="submit" style="display:none;">
        </form>
    `;

    class periodBarChartBuilder extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: "open" });
            this.shadowRoot.appendChild(builderTemplate.content.cloneNode(true));
        }

        connectedCallback() {
            const form = this.shadowRoot.getElementById("form");
            
            // Listen to inputs
            const inputs = form.querySelectorAll("input");
            inputs.forEach(input => {
                input.addEventListener("change", this._submit.bind(this));
                input.addEventListener("input", (e) => {
                    // Update slider text immediately for feedback
                    if(e.target.id === 'barWidth') {
                        this.shadowRoot.getElementById('barWidthVal').innerText = e.target.value + '%';
                    }
                    this._submit(e);
                });
            });
        }

        _submit(e) {
            if(e && e.preventDefault) e.preventDefault();
            
            this.dispatchEvent(new CustomEvent("propertiesChanged", {
                detail: {
                    properties: {
                        measureName: this.measureName,
                        barColor: this.barColor,
                        barWidth: this.barWidth,
                        showLabels: this.showLabels
                    }
                }
            }));
        }

        // --- Getters & Setters ---

        get measureName() {
            return this.shadowRoot.getElementById("measureName").value;
        }
        set measureName(val) {
            this.shadowRoot.getElementById("measureName").value = val;
        }

        get barColor() {
            return this.shadowRoot.getElementById("barColor").value;
        }
        set barColor(val) {
            this.shadowRoot.getElementById("barColor").value = val;
        }

        get barWidth() { return parseInt(this.shadowRoot.getElementById("barWidth").value); }
        set barWidth(val) { 
            this.shadowRoot.getElementById("barWidth").value = val; 
            this.shadowRoot.getElementById("barWidthVal").innerText = val + '%';
        }

        get showLabels() {
            return this.shadowRoot.getElementById("showLabels").checked;
        }
        set showLabels(val) {
            this.shadowRoot.getElementById("showLabels").checked = val;
        }
    }

    // =================================================================================
    // PART 2: MAIN WIDGET (Runtime)
    // =================================================================================

    const widgetTemplate = document.createElement("template");
    widgetTemplate.innerHTML = `
        <style>
            :host {
                display: block;
                width: 100%;
                height: 100%;
                font-family: '72', 'Segoe UI', Arial, sans-serif;
            }
            .container {
                display: flex;
                flex-direction: column;
                height: 100%;
                width: 100%;
                padding: 10px;
                box-sizing: border-box;
                position: relative; /* Anchor for absolute tooltip */
                overflow: hidden;   /* Keeps content inside */
                 /* 
                   RESERVED SPACE FOR TOOLTIP:
                   We add 70px padding to the top. This ensures that even if a bar is
                   at 100% height, there is empty space above it for the tooltip.
                */
                padding: 70px 10px 10px 10px; 
            }
            .chart-body {
                display: flex;
                align-items: flex-end;
                justify-content: space-around; 
                flex: 1;
                width: 100%;
                gap: 2px;
            }
            .bar-wrapper {
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                height: 100%;
                justify-content: flex-end;
                position: relative;
            }
            .bar {
                width: var(--bar-width, 20%);
                min-height: 1px;
                background-color: var(--bar-color, #aaaaaa);
                transition: height 0.5s ease, opacity 0.2s;
                border-radius: 2px 2px 0 0;
                cursor: pointer;
            }
            .bar:hover {
                opacity: 0.8;
            }

            /* Tooltip Styling */
            #tooltip {
                position: absolute; /* Relative to .container */
                top: 0; left: 0;
                background-color: rgba(249, 246, 246, 0.91);
                color: #000000ff;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 11px;
                line-height: 1.4;
                pointer-events: none; /* Allows mouse to pass through */
                opacity: 0;
                transition: opacity 0.2s;
                z-index: 100; /* Ensures it sits ON TOP of all bars */
                white-space: nowrap;
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            }

            .axis-label {
                font-size: 11px;
                color: #555;
                margin-top: 5px;
                text-align: center;
                display: none;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 100%;
            }
            .show-labels .axis-label {
                display: block;
            }
            .message {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #999;
                font-size: 14px;
                text-align: center;
            }
        </style>
        
        <div class="container" id="container">
            <div class="chart-body" id="chartBody"></div>
            <!-- Tooltip is a sibling of chart-body, so it can float over everything -->
            <div id="tooltip"></div>
        </div>
    `;

    class periodBarChart extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: "open" });
            this.shadowRoot.appendChild(widgetTemplate.content.cloneNode(true));
            
            // Initial Properties
            this._props = {
                measureName: "",
                barColor: "#d3d3d3", // Default Light Gray
                barWidth: 20,       // Default slimmer width (Sparkline style)
                showLabels: false,   // Default Off
                chartData: ""        // Raw JSON string
            };
        }

        // --- Lifecycle Methods ---

        onCustomWidgetBeforeUpdate(changedProperties) {
            this._props = { ...this._props, ...changedProperties };
        }

        onCustomWidgetAfterUpdate(changedProperties) {
            // Re-render whenever any property changes
            this.renderChart();
        }

        // --- Main Logic ---

        renderChart(rawData) {
            const chartBody = this.shadowRoot.getElementById("chartBody");
            const container = this.shadowRoot.getElementById("container");
            const tooltip = this.shadowRoot.getElementById("tooltip");

            // 1. Clear previous content
            chartBody.innerHTML = "";
            
            // Remove any old message if exists
            const existingMsg = this.shadowRoot.querySelector(".message");
            if(existingMsg) existingMsg.remove();

            // 2. Parse and Validate Data
            let data = [];
            try {
                if (typeof rawData === "string") {
                    data = JSON.parse(rawData);
                } else {
                    data = rawData;
                }
            } catch (e) {
                chartBody.innerHTML = `<div style="color:red; padding:10px;">Error parsing JSON data</div>`;
                return;
            }

            if (!data || data.length === 0) {
                chartBody.innerHTML = `<div style="padding:10px; color:#999; font-style:italic">No Data Available.</div>`;
                return;
            }

            // 3. Validate Data Completeness (Must have year, period, value, currency)
            const isValid = data.every(item => 
                item.hasOwnProperty('year') && 
                item.hasOwnProperty('period') && 
                item.hasOwnProperty('value') && 
                item.hasOwnProperty('currency')
            );

            if (!isValid) {
                this._showMessage("Incomplete Data (Missing required fields)");
                return;
            }

            // 4. Determine Scale
            // Handle string numbers just in case via parseFloat
            const maxValue = Math.max(...data.map(d => parseFloat(d.value)), 1);

            // 5. Apply Styling
            container.classList.toggle("show-labels", this._props.showLabels);
            container.style.setProperty('--bar-color', this._props.barColor);
            container.style.setProperty('--bar-width', this._props.barWidth + "%");

            // 6. Generate DOM
            data.forEach(item => {
                const val = parseFloat(item.value);
                const heightPct = (val / maxValue) * 100;
                const measure = this._props.measureName;

                const wrapper = document.createElement("div");
                wrapper.className = "bar-wrapper";
                wrapper.innerHTML = `
                    <div class="bar" style="height: ${heightPct}%"></div>
                    <div class="axis-label">${item.period}<br>${item.year}</div>
                `;
                
                chartBody.appendChild(wrapper);

                // --- TOOLTIP LOGIC ---
                const barElement = wrapper.querySelector('.bar');

                barElement.addEventListener("mouseenter", () => {
                    tooltip.innerHTML = `
                        <strong style="font-size:1.1em">${measure}</strong><br>
                        ${item.period} - ${item.year}<br>
                        <strong style="font-size:1.1em">${val.toLocaleString()} ${item.currency}</strong>
                    `;
                    
                    // First display it invisibly to calculate dimensions
                    tooltip.style.opacity = "0";
                    tooltip.style.display = "block";
                    
                    this._updateTooltipPosition(barElement, tooltip, container);
                    
                    tooltip.style.opacity = "1";
                });
                
                // Recalculate on mouse leave/enter to ensure stability
                barElement.addEventListener("mouseleave", () => {
                    tooltip.style.opacity = "0";
                });
            });
        }

        // --- Smart Positioning Logic ---
        _updateTooltipPosition(bar, tooltip, container) {
            const barRect = bar.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();

            // 1. Calculate Horizontal Center (relative to container)
            let relativeLeft = (barRect.left - containerRect.left) + (barRect.width / 2) - (tooltipRect.width / 2);
            
            // 2. Calculate Vertical Top (Always above bar)
            // relativeTop = Top of Bar (rel to container) - Tooltip Height - Gap
            let relativeTop = (barRect.top - containerRect.top) - tooltipRect.height - 10;
            
            // 3. Horizontal Clamping (Prevent falling off edges)
            if (relativeLeft < 0) {
                relativeLeft = 5; 
            }
            if (relativeLeft + tooltipRect.width > containerRect.width) {
                relativeLeft = containerRect.width - tooltipRect.width - 5;
            }

            // Apply positions
            tooltip.style.left = relativeLeft + "px";
            tooltip.style.top = relativeTop + "px";
        }


        _showMessage(text) {
            const container = this.shadowRoot.getElementById("container");
            const msg = document.createElement("div");
            msg.className = "message";
            msg.innerText = text;
            container.appendChild(msg);
        }

        // --- SAC Script Method ---
        setChartData(newData) {
            // Takes a JSON String
            //this.onCustomWidgetBeforeUpdate({ chartData: newData });
            //this.onCustomWidgetAfterUpdate({ chartData: newData });
            this.renderChart(newData);
        }
    }

    // Register Web Components
    customElements.define("period-bar-chart", periodBarChart);
    customElements.define("period-bar-chart-builder", periodBarChartBuilder);

})();
