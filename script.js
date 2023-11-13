const initLabels = ["buying", "maint" ,"doors","persons", "lug_boot", "safety", "classLabel"]
const labelToNumber = label => initLabels.indexOf(label);
const labels = {
    buying: ["vhigh", "high", "med", "low"],
    maint: ["vhigh", "high", "med", "low"],
    doors: ["2", "3", "4", "5more"],
    persons: ["2", "4", "more"],
    lug_boot: ["small", "med", "big"],
    safety: ["low", "med", "high"],
    classLabel: ["unacc", "acc", "good", "vgood"]
};

const classLabelColors = {
    unacc: "#E57373",
    acc: "#81C784",
    good: "#64B5F6",
    vgood: "#FFD54F"
};

var coloringByClass = true

var selectedLabels = initLabels
d3.text("http://vis.lab.djosix.com:2023/data/car.data").then(function(text) {
    const checkboxes = document.querySelectorAll('.selectors input[type="checkbox"]');
    const colorSelector = document.getElementById('color-selector');

    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function () {
            // Clone the current selectedLabels array
            var oldSelectedLabels = selectedLabels.slice();
    
            // Update the selectedLabels based on the order of checked checkboxes
            selectedLabels = Array.from(checkboxes)
                .filter(checkbox => checkbox.checked)
                .map(checkbox => checkbox.value);
    
            // Compare old and new selectedLabels arrays
            const addedLabels = selectedLabels.filter(label => !oldSelectedLabels.includes(label));
            const removedLabels = oldSelectedLabels.filter(label => !selectedLabels.includes(label));
    
            // Move added labels to the end of the array
            selectedLabels = selectedLabels.filter(label => !addedLabels.includes(label));
            console.log("before push", selectedLabels)
            selectedLabels.push(...addedLabels);
            console.log("after push", selectedLabels)

    
            // Remove labels that were unchecked
            removedLabels.forEach(label => {
                const index = selectedLabels.indexOf(label);
                if (index !== -1) {
                    selectedLabels.splice(index, 1);
                }
            });
            console.log("init", selectedLabels)
            // Update the chart
            updateSankey();
        });
    });

    // colorSelector EventListener
    colorSelector.addEventListener('change', function() {
        coloringByClass = colorSelector.value === 'ClassLabel';
        updateSankey();
    });

    // Init the graph
    updateSankey()

    function updateSankey() {
        
        // No Update
        if (selectedLabels.length < 2) {
            return
        }

        const frequencyCounts = processData(text, selectedLabels)
        console.log(frequencyCounts.length, frequencyCounts)

        const sankeyData = convertToSankeyData(frequencyCounts, selectedLabels);
        console.log(sankeyData);

        d3.select("svg").remove();

        // Init SVG size
        const svg_width = 1500
        const svg_height = 1200
        const margin = { top: 50, right: 180, bottom: 150, left: 50 };
        const width = svg_width - margin.left - margin.right;
        const height = svg_height - margin.top - margin.bottom;

        // Init SVG
        const svg = d3.select("body")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Init Sankey Diagram
        const sankey = d3.sankey()
            .nodeWidth(40)
            .nodePadding(60)
            .size([width, height]);

        const { nodes, links } = sankey(sankeyData);

        // colorScale (By frequency)
        const colorScale = d3.scaleSequential(d3.interpolateBlues)
        .domain([0, d3.max(links, d => d.value)]);

        // Draw Links
        const linkSelection = svg.selectAll(".link")
            .data(links)
            .enter().append("path")
            .attr("class", "link")
            .attr("d", d3.sankeyLinkHorizontal())
            .style("stroke-width", d => Math.max(1, d.width))
            .style("stroke", d => {
                // Coloring By classLabel / frequency
                if (coloringByClass) {
                    return classLabelColors[d.classLabel]
                }
                return colorScale(d.value);
            })
            .style("fill", "none")
            .style("opacity", 0.9)
            .on("mouseover", function (event, d) {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .style("opacity", 0.5);  // Adjust the opacity on mouseover
                showTooltip(d); // Call showTooltip with the data d
            })
            .on("mouseout", function () {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .style("opacity", 0.9);  // Reset the opacity on mouseout
                hideTooltip();
            });

        // Draw nodes
        const nodeSelection = svg.selectAll(".node")
            .data(nodes)
            .enter().append("rect")
            .attr("class", "node")
            .attr("x", d => d.x0)
            .attr("y", d => d.y0)
            .attr("height", d => d.y1 - d.y0)
            .attr("width", d => d.x1 - d.x0)
            .style("fill", "#bbb")
            .style("opacity", 1)
            .on("mouseover", function (event, d) {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .style("opacity", 0.5);
                showTooltip(d, false);
            })
            .on("mouseout", function () {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .style("opacity", 1);
                hideTooltip();
            })
            .call(d3.drag()  // Apply drag behavior
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));

        // Add labels
        const textSelection = svg.selectAll(".text")
            .data(nodes.filter(d => d.value !== 0))
            .enter().append("text")
            .attr("class", "text")
            .attr("x", d => (d.x0 + d.x1) / 2)
            .attr("y", d => (d.y0 + d.y1) / 2)
            .attr("dy", "0.35em")
            .text(d => d.name)
            .style("font-size", "9px")
            .style("text-anchor", "middle")
            .style("fill", "#000")
            .style("font-weight", "bold");


        // Init legend container
        const legendContainer = svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${svg_width - 180 }, 20)`);

        // Draw legend
        const legendData = coloringByClass ? Object.entries(classLabelColors) : colorScale.ticks(5).map(value => ({ value }));

        const legendItems = legendContainer.selectAll(".legend-item")
            .data(legendData)
            .enter().append("g")
            .attr("class", "legend-item")
            .attr("transform", (d, i) => `translate(0, ${i * 20})`);

        // Draw legend rect
        legendItems.append("rect")
            .attr("width", 15)
            .attr("height", 15)
            .style("fill", d => (coloringByClass ? d[1] : colorScale(d.value)));

        // Add legend text
        legendItems.append("text")
            .attr("x", 20)
            .attr("y", 10)
            .text(d => coloringByClass ? d[0] : d.value);
            
        // show Tooltip
        function showTooltip(d, isLink=true) {
            const tooltip = d3.select("#tooltip");
        
            tooltip.transition().duration(200)
                .style("opacity", 0.9) // Fade in
            if (isLink) {
                tooltip.html(`Class: ${d.classLabel}<br>Value: ${d.value}`)
            }
            else {
                tooltip.html(`Value: ${d.value}`)
            }
        }
        
        function hideTooltip() {
            d3.select("#tooltip").transition().duration(500).style("opacity", 0) // Fade out
        }

        // Define drag functions
        function dragstarted(event, d) {
            d.__x = event.x;
            d.__y = event.y;
            d.__x0 = d.x0;
            d.__y0 = d.y0;
            d.__x1 = d.x1;
            d.__y1 = d.y1;
        }

        function dragged(event, d) {
            const dx = event.x - d.__x;
            const dy = event.y - d.__y;
        
            // Update x0, x1, y0, y1 based on drag distance
            d.x0 = d.__x0 + dx;
            d.x1 = d.__x1 + dx;
            d.y0 = d.__y0 + dy;
            d.y1 = d.__y1 + dy;
        
            // Adjust for node width
            d.x0 = Math.max(0, Math.min(width - sankey.nodeWidth(), d.x0));
            d.x1 = d.x0 + sankey.nodeWidth() + 5;
        
            // Check and constrain the position within the boundaries
            if (d.x1 > width) {
                d.x0 = width - sankey.nodeWidth();
                d.x1 = width;
            }
        
            if (d.y0 < 0) {
                d.y0 = 0;
                d.y1 = d.__y1 - d.__y0;
            }
        
            if (d.y1 > height) {
                d.y0 = height - (d.__y1 - d.__y0);
                d.y1 = height;
            }
        
            // Update the position of the node
            d3.select(this)
                .attr("x", d.x0 = event.x)
                .attr("y", d.y0 = event.y);

            // Update the position of the associated text
            svg.selectAll(".text")
                .filter(text => text === d) // Filter based on data binding
                .attr("x", (d.x0 + d.x1) / 2)
                .attr("y", (d.y0 + d.y1) / 2);

            sankey.update({ nodes, links });
            svg.selectAll(".link").attr("d", d3.sankeyLinkHorizontal());
        }

        function dragended(event, d) {
            d3.select(this).classed("active", false);
        }
    }
        
});

function processData(text, selectedLabels) {
    // Init frequencyCounts
    const frequencyCounts = {};

    const data = d3.csvParseRows(text);

    for (let i = 0; i < data.length; i++) {
        for (let j = 0; j < selectedLabels.length - 1; j++) {
            const labelIndex1 = labelToNumber(selectedLabels[j]);
            const labelIndex2 = labelToNumber(selectedLabels[j + 1]);
            
            const label1 = data[i][labelIndex1]
            const label2 = data[i][labelIndex2]

            const combination = `${selectedLabels[j]}-${label1}-${selectedLabels[j + 1]}-${label2}-${data[i][6]}`;

            frequencyCounts[combination] = (frequencyCounts[combination] || 0) + 1;
        }
    }
    
    return frequencyCounts;
}
  
  function convertToSankeyData(frequencyCounts, selectedLabels) {
    // Init Sankey Diagram nodes & links
    var selectedLabelsDir = {}
    for (let i=0; i<=selectedLabels.length; i++) {
        selectedLabelsDir[selectedLabels[i]] = labels[selectedLabels[i]]
    }

    let overallIndex = 0;
    const nodes = Object.entries(selectedLabelsDir).flatMap(([label, values], index) => {
      if (selectedLabels.includes(label)) {
        return values.map((value) => ({ name: `${label}-${value}`, index: overallIndex++ })); // 添加 classLabel
      } else {
        return [];
      }
    });
  
    const links = [];
  
    // By frequencyCounts
    // Turn inti Sankey Diagram Format
    for (const combination in frequencyCounts) {
      const [sourceLabel, sourceValue, targetLabel, targetValue, classLabel] = combination.split('-');
  
      // Find sourceNode / targetNode
      const sourceNode = nodes.find((node) => node.name === `${sourceLabel}-${sourceValue}`);
      const targetNode = nodes.find((node) => node.name === `${targetLabel}-${targetValue}`);
  
      if (sourceNode && targetNode) {
        const value = frequencyCounts[combination];
        links.push({ source: sourceNode.index, target: targetNode.index, value, classLabel: classLabel });
      }
    }
  
    return { nodes, links };
  }
  