---
name: chart-visualization
description: This skill should be used when the user wants to visualize data. It intelligently selects the most suitable chart type from 26 available options, extracts parameters based on detailed specifications, and generates a chart image using a JavaScript script.
dependency:
  nodejs: ">=18.0.0"
---

# Chart Visualization Skill

This skill provides a comprehensive workflow for transforming data into visual charts. It handles chart selection, parameter extraction, and image generation.

## Workflow

To visualize data, follow these steps:

### 1. Intelligent Chart Selection
Analyze the user's data features to determine the most appropriate chart type. Use the following guidelines (and consult `references/` for detailed specs):

- **Time Series**: Use `generate_line_chart` (trends) or `generate_area_chart` (accumulated trends). Use `generate_dual_axes_chart` for two different scales.
- **Comparisons**: Use `generate_bar_chart` (categorical) or `generate_column_chart`. Use `generate_histogram_chart` for frequency distributions.
- **Part-to-Whole**: Use `generate_pie_chart` or `generate_treemap_chart` (hierarchical).
- **Relationships & Flow**: Use `generate_scatter_chart` (correlation), `generate_sankey_chart` (flow), or `generate_venn_chart` (overlap).
- **Maps**: Use `generate_district_map` (regions), `generate_pin_map` (points), or `generate_path_map` (routes).
- **Hierarchies & Trees**: Use `generate_organization_chart` or `generate_mind_map`.
- **Specialized**:
    - `generate_radar_chart`: Multi-dimensional comparison.
    - `generate_funnel_chart`: Process stages.
    - `generate_liquid_chart`: Percentage/Progress.
    - `generate_word_cloud_chart`: Text frequency.
    - `generate_boxplot_chart` or `generate_violin_chart`: Statistical distribution.
    - `generate_network_graph`: Complex node-edge relationships.
    - `generate_fishbone_diagram`: Cause-effect analysis.
    - `generate_flow_diagram`: Process flow.
    - `generate_spreadsheet`: Tabular data or pivot tables for structured data display and cross-tabulation.

### 2. Parameter Extraction
Once a chart type is selected, read the corresponding file in the `references/` directory (e.g., `references/generate_line_chart.md`) to identify the required and optional fields.
Extract the data from the user's input and map it to the expected `args` format.

### 3. Chart Generation
Invoke the `scripts/generate.js` script with a JSON payload.

**Payload Format:**
```json
{
  "tool": "generate_chart_type_name",
  "args": {
    "data": [...],
    "title": "...",
    "theme": "...",
    "style": { ... }
  }
}
```

**Execution Command:**
```bash
node ./scripts/generate.js '<payload_json>'
```

### 4. Result Return
The script will output the URL of the generated chart image.
Return the following to the user:
- The image URL.
- The complete `args` (specification) used for generation.

## Data Sources for Visualization (data-extraction skill)

**For visualizing real-world data from specific platforms:**

| Visualization Type | Data Source | Extraction Method |
|--------------------|-------------|-------------------|
| **Technology Trends** | GitHub stars over time, Stack Overflow tag trends | data-extraction/developer-platforms |
| **Market Analysis** | Crypto price charts, economic indicators, stock trends | data-extraction/data-apis + finance-markets |
| **Product Metrics** | Amazon review ratings, ProductHunt upvotes, G2 scores | data-extraction/ecommerce-shopping + business-productivity |
| **Social Sentiment** | Reddit post engagement, Medium claps, social metrics | data-extraction/social-media-content |
| **Weather Patterns** | Historical weather data, climate trends | data-extraction/data-apis/weather |
| **Academic Trends** | Citation networks, paper publication trends | data-extraction/academic-research |
| **Entertainment Stats** | Spotify chart positions, Steam player counts, book ratings | data-extraction/entertainment-media |

**Workflow:**
1. **Extract data** → Use data-extraction to gather structured data
2. **Transform** → Format data for chart visualization
3. **Visualize** → Generate chart using this skill
4. **Present** → Display chart with insights

**Example:**
```
Visualize: "GitHub stars trend for React frameworks"
1. data-extraction/developer-platforms/github → Extract star history
2. Transform to time series format
3. generate_line_chart → Create trend visualization
4. Present chart showing framework popularity over time
```

## Related Skills

### Python Visualization Libraries

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **matplotlib** | Static publication-quality plots, scientific figures | Academic papers, research reports, static charts with precise control |
| **seaborn** | Statistical data visualization, beautiful defaults | Statistical analysis, correlation matrices, distribution plots |
| **plotly** | Interactive web-embeddable charts with hover/zoom | Dashboards, exploratory analysis, presentations requiring interactivity |

**When to use each:**
- **This skill (chart-visualization)** — Quick web-ready charts with 26+ types, JavaScript-based, good for general business visualizations
- **matplotlib** — Publication-quality static plots, fine-grained control, scientific/academic contexts
- **seaborn** — Statistical visualizations with beautiful defaults, built on matplotlib
- **plotly** — Interactive charts for web dashboards, requires hover info, zoom, pan capabilities

### Diagram & Flowchart Tools

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **mermaid-expert** | Flowcharts, sequence diagrams, Gantt charts, ER diagrams | Process flows, system architecture, database schemas, project timelines |

**Common use cases:**
- **Flowcharts** → mermaid-expert (process flows, decision trees)
- **Data flow diagrams** → mermaid-expert (system architecture)
- **Data visualizations** → chart-visualization, matplotlib, plotly, seaborn (charts and graphs)

### Machine Learning & Data Science

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **scikit-learn** | Machine learning algorithms, model evaluation | Predictive modeling, classification, regression, clustering |
| **data-scientist** | End-to-end data science workflows | Complete data analysis projects, statistical modeling |
| **data-engineer** | Data pipelines, ETL processes | Data preparation before visualization |

**Workflow for ML visualizations:**
1. **scikit-learn** — Train model, generate predictions
2. **matplotlib/seaborn** — Visualize model performance (confusion matrix, ROC curves, feature importance)
3. **plotly** — Create interactive model exploration dashboards
4. **chart-visualization** — Generate web-ready charts for presentations

### Typical Workflows

**Statistical Analysis & Visualization:**
1. **data-extraction** — Gather data from sources
2. **data-scientist** — Perform statistical analysis
3. **seaborn** — Create statistical plots (distributions, correlations)
4. **chart-visualization** — Generate web-ready summary charts

**Machine Learning Model Evaluation:**
1. **scikit-learn** — Train and evaluate model
2. **matplotlib** — Plot confusion matrix, ROC curves, learning curves
3. **seaborn** — Visualize feature correlations and distributions
4. **plotly** — Create interactive model performance dashboard

**Business Intelligence Dashboard:**
1. **data-extraction** — Extract business metrics
2. **chart-visualization** — Generate quick overview charts
3. **plotly** — Create interactive drill-down visualizations
4. **mermaid-expert** — Add process flow diagrams

**Research Paper Figures:**
1. **data-scientist** — Analyze research data
2. **matplotlib** — Create publication-quality static figures
3. **seaborn** — Generate statistical visualizations
4. **chart-visualization** — Create supplementary web figures

**Process Documentation:**
1. **mermaid-expert** — Create flowcharts and sequence diagrams
2. **chart-visualization** — Add data-driven charts
3. **plotly** — Add interactive exploration tools

### Quick Reference

**Choose visualization tool based on output:**
- **Web dashboards** → plotly (interactive) or chart-visualization (quick)
- **Research papers** → matplotlib (publication-quality) or seaborn (statistical)
- **Business reports** → chart-visualization (web-ready) or matplotlib (print-ready)
- **Process diagrams** → mermaid-expert (flowcharts, architecture)
- **ML model evaluation** → matplotlib + seaborn (static) or plotly (interactive)

**Choose based on interactivity:**
- **Static images** → matplotlib, seaborn, chart-visualization
- **Interactive web** → plotly
- **Diagrams** → mermaid-expert

**Choose based on data type:**
- **Statistical data** → seaborn (distributions, correlations)
- **Time series** → chart-visualization, matplotlib, plotly
- **ML model results** → matplotlib + seaborn (evaluation metrics)
- **Business metrics** → chart-visualization, plotly
- **Process flows** → mermaid-expert

---

## Reference Material
Detailed specifications for each chart type are located in the `references/` directory. Consult these files to ensure the `args` passed to the script match the expected schema.

## License

This `SKILL.md` is provided by [antvis/chart-visualization-skills](https://github.com/antvis/chart-visualization-skills).
Licensed under the [MIT License](https://github.com/antvis/chart-visualization-skills/blob/master/LICENSE).