// Source code for draggable globe: https://observablehq.com/@michael-keith/draggable-globe-in-d3

async function draw() {
  const countries_raw = await d3.json("./data/countries-110m.json");
  const countries = topojson.feature(countries_raw, countries_raw.objects.countries).features;
  const usa_raw = await d3.json("./data/states-10m.json");
  const usa = topojson.feature(usa_raw, usa_raw.objects.states);

  const cities = await d3.csv("./data/city_matches.csv"); // flag emojis added manually
  const intl_cities = cities.map(d => {
    return {
      city: d.intl_city,
      country: d.country,
      city_lat: +d.city_lat,
      city_long: +d.city_long,
      us_city: d.us_city,
      us_state: d.state_name,
      flag_emoji: d.flag_emoji,
    };
  });

  // dataset of only unique city names
  const intl_cities_unique = [...new Set(intl_cities.map(d => JSON.stringify(d)))].map(d => JSON.parse(d));

  const width = 700;
  const height = 700;
  const sensitivity = 60; // for dragging

  let projection = d3
    .geoOrthographic()
    .scale(325)
    .translate([width / 2, height / 2])
    .center([0, 0])
    .rotate([0, -35]);
  let initialScale = projection.scale();

  let path = d3.geoPath().projection(projection);

  const svg = d3.select("#app").append("svg").attr("width", width).attr("height", height);

  // WATER
  svg
    .append("circle")
    .attr("fill", "#7C96AB")
    .attr("stroke", "#0A4D68")
    .attr("stroke-width", "0.2")
    .attr("cx", width / 2)
    .attr("cy", height / 2)
    .attr("r", initialScale)
    .style("filter", "drop-shadow(0 0 0.5rem rgba(166, 208, 221, 0.5))");

  // DRAG TO ROTATE GLOBE
  svg.call(
    d3.drag().on("drag", event => {
      const rotate = projection.rotate();
      const k = sensitivity / projection.scale();
      projection.rotate([rotate[0] + event.dx * k, rotate[1] - event.dy * k]);
      path = d3.geoPath().projection(projection);
      map.selectAll("path").attr("d", path);
    })
  );

  const map = svg.append("g");

  // COUNTRIES
  const land = map.selectAll("path").data(countries).join("path").attr("d", path);
  land
    .attr("fill", d => (d.properties.name === "United States of America" ? "#cfd7ba" : "#CDE990"))
    .style("stroke", "#5D9C59")
    .style("stroke-width", 0.75)
    .style("opacity", 0.8)
    .style("filter", "drop-shadow(2px 3px 3px rgb(0.5 0.5 0.5 / 0.1))");

  // DRAW CITIES: draw circles using paths and not circles so that they stay in right position when dragging globe
  const points = map
    .selectAll(".path")
    .data(intl_cities_unique)
    .join("path")
    .each(function (d) {
      d3.select(this).datum({
        type: "Point",
        city: d.city,
        country: d.country,
        flag_emoji: d.flag_emoji,
        us_city: d.us_city,
        us_state: d.us_state,
        coordinates: [d.city_long, d.city_lat],
      });
    })
    .attr("d", path)
    .attr("r", 6)
    .attr("fill", "silver")
    .attr("stroke", "#fff");

  points.on("click", function (d, e) {
    let matching_cities = [];

    let arrayMatch = cities.filter(d => d.intl_city === e.city); // for point data: e.target.__data__.city
    arrayMatch.forEach(d => {
      origin = [+d.city_long, +d.city_lat];
      target = [+d.us_city_long, +d.us_city_lat];
      obj = { type: "LineString", coordinates: [origin, target] };
      matching_cities.push(obj);
    });

    // draw US states
    map.select(".usa").remove();
    map
      .selectAll(".usa")
      .data(usa.features)
      .join("path")
      .attr("d", path)
      .attr("class", "usa")
      .attr("fill", "transparent")
      .style("stroke", "#617143")
      .style("stroke-width", 0.5)
      .style("filter", "drop-shadow(2px 3px 3px rgb(0.5 0.5 0.5 / 0.1))");

    map.selectAll(".match-line").remove();

    map
      .selectAll()
      .data(matching_cities)
      .join("path")
      .attr("d", d => path(d))
      .attr("class", "match-line")
      .style("fill", "none")
      .style("stroke", "#E06469")
      .style("stroke-width", 1)
      .style("stroke-dasharray", "2 2");

    projection.rotate([95.7, -37.1]);
    path = d3.geoPath().projection(projection);
    svg.selectAll("path").transition().duration(2500).ease(d3.easeLinear).attr("d", path);

    let matching_us_cities = [];

    arrayMatch.forEach(d => {
      target = [+d.us_city_long, +d.us_city_lat];
      us_city = d.us_city;
      us_state = d.state_name;
      us_obj = { type: "LineString", coordinates: [target], city: us_city, state: us_state };
      matching_us_cities.push(us_obj);
    });

    // text showing matches
    d3.select("text").remove();

    d3.select(".matches-text")
      .append("text")
      .attr("class", "matches-text")
      .html(
        `<span style="font-weight:bold; color:#f7d060;">${e.city}</span> ${
          e.flag_emoji
        } matches <span style="color:#f7d060;">${matching_us_cities.length}</span> U.S. ${
          matching_us_cities.length > 1 ? "municipalities" : "municipality"
        }:`
      );

    //TABLE
    d3.selectAll("thead").remove();
    d3.selectAll("tbody").remove();
    d3.selectAll("td").remove();

    const table = d3.select("#table-matches");

    // header row
    const thead = table.append("thead").selectAll("th").data(Object.keys(matching_us_cities[0]).slice(2)).join("th");
    thead
      .append("tr")
      .text(d => d)
      .style("text-transform", "uppercase")
      .style("font-size", "0.85em")
      .style("font-weight", "700")
      .style("color", "#F3E99F");

    // body rows
    const rows = table.append("tbody").selectAll("tr").data(matching_us_cities).join("tr");

    // data point per cell
    rows
      .selectAll("td")
      .data(d => Object.values(d).slice(2))
      .join("td")
      .text(d => d)
      .attr("class", "table-text");

    rows.on("click", (d, e) => {
      map
        .selectAll(".circle")
        .data(e.coordinates)
        .join("circle")
        .attr("cx", d => projection(d)[0])
        .attr("cy", d => projection(d)[1])
        .transition()
        .duration(1000)
        .ease(d3.easeLinear)
        .attr("fill", "#E76161")
        .attr("stroke", "#fff")
        .attr("r", "4")
        .style("opacity", 0.6)
        .transition()
        .duration(1000)
        .ease(d3.easeLinear)
        .style("opacity", 0);
    });
  });

  rotateGlobe();

  // ROTATE GLOBE
  function rotateGlobe() {
    const toggle = document.querySelector('input[type="checkbox"]');
    let timer;

    toggle.addEventListener("change", function () {
      if (toggle.checked) {
        document.querySelector(".toggle-text").textContent = `Click to stop rotating globe`;

        timer = d3.timer(function (elapsed) {
          const rotate = projection.rotate();
          const k = sensitivity / projection.scale();
          projection.rotate([rotate[0] - 1 * k, rotate[1]]);
          path = d3.geoPath().projection(projection);
          svg.selectAll("path").attr("d", path);
        }, 600);
      } else {
        document.querySelector(".toggle-text").textContent = `Click to rotate globe`;

        timer.stop();
      }
    });
  }
}
draw();
