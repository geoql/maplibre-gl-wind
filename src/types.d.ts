declare module '@mapbox/geojson-rewind' {
  function rewind<T extends GeoJSON.GeoJSON>(geojson: T, outer?: boolean): T;
  export default rewind;
}
