var VMAPUtil = {
    hexToRgb: function (hex) {
        // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
        var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        hex = hex.replace(shorthandRegex, function (m, r, g, b) {
            return r + r + g + g + b + b;
        });

        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    },
    indexOf: function (layers, layer) {
        var length = layers.getLength();
        for (var i = 0; i < length; i++) {
            if (layer === layers.item(i)) {
                return i;
            }
        }
        return -1;
    },
    convertWGStoPTVMercator: function (x, y) {
        var RPI = Math.PI * 6371000.0;
        var xCoord = x * RPI / 180;
        var yCoord = Math.log(Math.tan((90 + y) * Math.PI / 360)) / (Math.PI / 180);
        yCoord = yCoord * RPI / 180;
        return [xCoord,yCoord];
    },
    convertPTVMercatortoWGS: function (x, y) {
        var RPI = Math.PI * 6371000.0;
        var lon = (x / RPI) * 180;
        var lat = (y / RPI) * 180;
        lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180)) - Math.PI / 2);
        return [lon,lat];
    }
}
var addProjection = (function () {
    var projection = new ol.proj.Projection({
        code: 'EPSG:505456',
        // The extent is used to determine zoom level 0. Recommended values for a
        // projection's validity extent can be found at http://epsg.io/.
        extent: [-19900000.0, -7300000.0, 19900000.0, 18600000.0],
        units: 'm'
    });
    ol.proj.addProjection(projection);
    ol.proj.addCoordinateTransforms(
        'EPSG:4326', projection,
        function (coordinate) {
			var coord = VMAPUtil.convertWGStoPTVMercator(coordinate[0], coordinate[1]);
            return coord.slice(0);
        },
        function (coordinate) {
            var coord = VMAPUtil.convertPTVMercatortoWGS(coordinate[0], coordinate[1]);
            return coord.slice(0);
        }
    );
})();
/**
 * @api {instance} VMAP(mapId) vmap
 * @apiName Creates a new vMap instance
 * @apiGroup VMAP
 *
 * @apiDescription Openlayers version v3.9.0
 *
 * @apiExample {create} Example usage1:
 *  var vmap = new VMAP('myVmap');
 *
 * @apiExample {create} Example usage2:
 *  var vmap = new VMAP('blubb');
 *
 * @apiParam {String} mapId Components unique ID.
 *
 */
var VMAP = function (mapId) {
    var vmap = this;
    /**
     * @api {function} VMAP.init() init
     * @apiName init
     * @apiGroup VMAP
     */
    this.init = function (config) {
        vmap.el = new ol.Map({
            target: mapId,
            interactions: ol.interaction.defaults({
                altShiftDragRotate: config.altShiftDragRotate,
                doubleClickZoom: config.doubleClickZoom,
                keyboard: config.keyboard,
                mouseWheelZoom: config.mouseWheelZoom,
                shiftDragZoom: config.shiftDragZoom,
                dragPan: config.dragPan,
                pinchRotate: config.pinchRotate,
                pinchZoom: config.pinchZoom
            }),
            view: new ol.View({
                center: ol.proj.transform(config.center, config.projection, 'EPSG:3857'),
                minZoom: config.minZoom,
                zoom: config.zoom,
                maxZoom: config.maxZoom
            }),
        });
        vmap.layers.setMapBackground(vmap.backgrounds.active);
        vmap.interactions.init();
        vmap.controls.init(config);
		vmap.events.init();
        vmap.views.initialView();
    };
    /**
     * @api {function} VMAP.updateSize() updateSize
     * @apiName force a recalculation of the map size
     * @apiGroup VMAP
     */
    this.updateSize = function () {
        vmap.el.updateSize();
    };
    /**
     * @api {subobject} VMAP.views{} views
     * @apiName views
     * @apiGroup VMAP
     */
    this.views = (function () {
        var mapRewinds = [];
        var rewindPos = -1;
        var setView = function (view) {
            vmap.el.getView().setCenter(view.pos);
            vmap.el.getView().setZoom(view.zoom);
        }
        return {
            /**
             * @api {function} VMAP.views.saveRewindPosition() saveRewindPosition
             * @apiName save the center and zoom of current map
             * @apiGroup VMAP views
             */
            saveRewindPosition: function () {
                var currView = {
                    pos: vmap.el.getView().getCenter(),
                    zoom: vmap.el.getView().getZoom()
                };

                for (var i = 0; i < mapRewinds.length; i++) {
                    if (mapRewinds[i].pos == currView.pos && mapRewinds[i].zoom == currView.zoom) {
                        return;
                    }
                }
                if (rewindPos < mapRewinds.length - 1) {
                    mapRewinds = mapRewinds.slice(0, rewindPos + 1);
                }
                mapRewinds.push(currView);
                rewindPos++;
            },
            /**
             * @api {function} VMAP.views.rewindView() rewindView
             * @apiName rewind View
             * @apiGroup VMAP views
             */
            rewindView: function () {
                if (rewindPos > 0) {
                    setView(mapRewinds[--rewindPos]);
                }
            },
            /**
             * @api {function} VMAP.views.forwardView() forwardView
             * @apiName forward View
             * @apiGroup VMAP views
             */
            forwardView: function () {
                if (rewindPos < mapRewinds.length - 1) {
                    setView(mapRewinds[++rewindPos]);
                }
            },
            /**
             * @api {function} VMAP.views.initialView() initialView
             * @apiName initial View
             * @apiGroup VMAP views
             */
            initialView: function () {
                this.saveRewindPosition();
            },
            /**
             * @api {function} VMAP.views.getExtent() getExtent
             * @apiName get the current map extent according to the given projection
             * @apiGroup VMAP views
             *
             * @apiParam {String} transform = 'EPSG:3857'
             */
            getExtent: function (transform) {
                transform = transform || 'EPSG:3857';
                var extent = vmap.el.getView().calculateExtent(vmap.el.getSize());
                return ol.proj.transformExtent(extent, 'EPSG:3857', transform);
            },
            /**
             * @api {function} VMAP.views.setCenter(center) setCenter
             * @apiName set map center
             * @apiGroup VMAP views
             *
             * @apiParam {Object} center
             */
            setCenter: function (center) {
                vmap.el.getView().setCenter(vmap.el.getView().constrainCenter(center));
            },
            /**
             * @api {function} VMAP.views.setZoom(zoom) setZoom
             * @apiName set map zoom
             * @apiGroup VMAP views
             *
             * @apiParam {Object} zoom
             */
            setZoom: function (zoom) {
                vmap.el.getView().setZoom(zoom);
            },
            /**
             * @api {function} VMAP.views.getCenter() getCenter
             * @apiName get map zoom
             * @apiGroup VMAP views
             *
             */
            getCenter: function () {
                return vmap.el.getView().getCenter();
            },
            /**
             * @api {function} VMAP.views.getZoom() getZoom
             * @apiName get map zoom
             * @apiGroup VMAP views
             *
             */
            getZoom: function () {
                return vmap.el.getView().getZoom();
            },
            /**
             * @api {function} VMAP.views.getView() getView
             * @apiName get map view
             * @apiGroup VMAP views
             *
             */
            getView: function () {
                return vmap.el.getView();
            },
            /**
             * @api {function} VMAP.views.zoomToFeatures(features) zoomToFeatures
             * @apiName zoom the view to the extent of features
             * @apiGroup VMAP views
             *
             */
            zoomToFeatures: function (features) {
                var extent = ol.extent.createEmpty();
                features.forEach(function (feature) {
                    ol.extent.extend(extent, feature.getGeometry().getExtent());
                });
                vmap.el.getView().fit(extent, vmap.el.getSize());
            },
            /**
             * @api {function} VMAP.views.zoomToExtent(extent) zoomToExtent
             * @apiName zoom the view to the extent
             * @apiGroup VMAP views
             *
             */
            zoomToExtent: function (extent) {
                vmap.el.getView().fit(extent, vmap.el.getSize());
            }
        }
    })();
    /**
     * @api {subobject} VMAP.backgrounds{} backgrounds
     * @apiName backgrounds
     * @apiGroup VMAP
     */
    this.backgrounds = {
        active: new ol.layer.Tile({
            source: new ol.source.OSM({
                url: 'http://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            })
        }),
        osm: {
            defaultText: 'OpenStreetMap',
            default: new ol.layer.Tile({
                source: new ol.source.OSM({
                    url: 'http://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                })
            })
        },
        bing: {
            defaultText: 'Bing Maps',
            default: new ol.layer.Tile({
                source: new ol.source.BingMaps({
                    key: 'Ak-dzM4wZjSqTlzveKz5u0d4IQ4bRzVI309GxmkgSVr1ewS6iPSrOvOKhA-CJlm3',
                    imagerySet: 'Aerial' //'Road','Aerial','AerialWithLabels','collinsBart','ordnanceSurvey'
                })
            })
        },
        ptv: {
            defaultText: 'Grundansicht',
            default: new ol.layer.Tile({
                title: 'Global Imagery',
                source: new ol.source.TileWMS({
                    url: 'http://ptvxserver01.haiberg.net:50050/WMS/WMS',
                    params: {
                        LAYERS: 'xmap-default',
                        VERSION: '1.1.1'
                    }
                })
            })
        },
        gmaps: {
            defaultText: 'Google Maps'
        },
        stamen: {
            defaultText: 'Stamen',
            terrain: new ol.layer.Tile({
                source: new ol.source.Stamen({
                    layer: 'terrain-labels'
                })
            }),
            default: new ol.layer.Tile({
                source: new ol.source.Stamen({
                    layer: 'watercolor'
                })
            })
        },
        mapquest: {
            defaultText: 'MapQuest',
            road: new ol.layer.Tile({
                visible: false,
                source: new ol.source.MapQuest({
                    layer: 'osm'
                })
            }),
            aerial: new ol.layer.Tile({
                visible: false,
                source: new ol.source.MapQuest({
                    layer: 'sat'
                })
            }),
            default: new ol.layer.Group({
                layers: [
                    new ol.layer.Tile({
                        source: new ol.source.MapQuest({
                            layer: 'sat'
                        })
                    }),
                    new ol.layer.Tile({
                        source: new ol.source.MapQuest({
                            layer: 'hyb'
                        })
                    })
                ]
            })
        }
    };
    /**
     * @api {subobject} VMAP.layers{} layers
     * @apiName layers
     * @apiGroup VMAP
     */
    this.layers = {
        /**
         * @api {function} VMAP.layers.raiseLayer(layer) raiseLayer
         * @apiName raises a layer
         * @apiGroup VMAP layers
         *
         * @apiParam {Object} layer layer
         *
         */
        raiseLayer: function (layer) {
            var layers = vmap.el.getLayers();
            var index = indexOf(layers, layer);
            if (index < layers.getLength() - 1) {
                var next = layers.item(index + 1);
                layers.setAt(index + 1, layer);
                layers.setAt(index, next);
            }
        },
        /**
         * @api {function} VMAP.layers.lowerLayer(layer) lowerLayer
         * @apiName lowers a layer
         * @apiGroup VMAP layers
         *
         * @apiParam {Object} layer layer
         *
         */
        lowerLayer: function (layer) {
            var layers = vmap.el.getLayers();
            var index = VMAPUtil.indexOf(layers, layer);
            if (index > 0) {
                var prev = layers.item(index - 1);
                layers.setAt(index - 1, layer);
                layers.setAt(index, prev);
            }
        },
        /**
         * @api {function} VMAP.layers.moveLayerToTop(layer) moveLayerToTop
         * @apiName moves a layer to top
         * @apiGroup VMAP layers
         *
         * @apiParam {Object} layer layer
         *
         */
        moveLayerToTop: function (layer) {
            var layers = vmap.el.getLayers();
            var index = VMAPUtil.indexOf(layers, layer);
            if (index != -1 && index != layers.getLength() - 1) {
                layers.removeAt(index);
                layers.setAt(layers.getLength(), layer);
            }
        },
        /**
         * @api {function} VMAP.layers.moveLayerToBottom(layer,aboveBackground) moveLayerToBottom
         * @apiName moves a layer to bottom
         * @apiGroup VMAP layers
         *
         * @apiParam {Object} layer layer
         * @apiParam {boolean} aboveBackground if the layer should appear above background. Default:true
         *
         */
        moveLayerToBottom: function (layer, aboveBackground) {
            var layers = vmap.el.getLayers();
            var index = VMAPUtil.indexOf(layers, layer);
            if (index != -1) {
                layers.removeAt(index);
                layers.insertAt(aboveBackground ? 1 : 0, layer);
            }
        },
        /**
         * @api {function} VMAP.layers.getLayerById(id) getLayerById
         * @apiName Get a layer by id
         * @apiGroup VMAP layers
         *
         * @apiParam {String} id layerid
         *
         */
        getLayerById: function (id) {
            var layer;
            vmap.el.getLayers().forEach(function (lyr) {
                if (lyr.get('id') == id) {
                    layer = lyr;
                }
            });
            return layer;
        },
        /**
         * @api {function} VMAP.layers.getAllLayers() getAllLayers
         * @apiName get all layers
         * @apiGroup VMAP layers
         *
         */
        getAllLayers: function () {
            return vmap.el.getLayers();
        },
        /**
         * @api {function} VMAP.layers.addLayer(layer) addLayer
         * @apiName add the given layer.
         * @apiGroup VMAP layers
         *
         * @apiParam {Object} layer layer
         *
         */
        addLayer: function (layer) {
            vmap.el.addLayer(layer);
        },
        /**
         * @api {function} VMAP.layers.removeLayer(layer) removeLayer
         * @apiName removes the given layer from the map.
         * @apiGroup VMAP layers
         *
         * @apiParam {Object} layer layer
         *
         */
        removeLayer: function (layer) {
            vmap.el.removeLayer(layer);
        },
        /**
         * @api {function} VMAP.layers.loadPoint(lon,lat) loadPoint
         * @apiName load the given point.
         * @apiGroup VMAP layers
         *
         * @apiParam {Number} lon
         * @apiParam {Number} lat
         */
        loadPoint: function (lon, lat) {
            var layer = vmap.layers.getLayerById('tempLayer');
            if (!layer) {
                layer = new ol.layer.Vector({
                    source: new ol.source.Vector(),
                    style: vmap.styles.defaultStyle
                });
                layer.set('id', 'tempLayer');
                vmap.el.addLayer(layer);
            }
            var coordinate = ol.proj.transform([lon, lat], 'EPSG:4326', 'EPSG:3857');
            var feature = new ol.Feature(new ol.geom.Point(coordinate));
            layer.getSource().addFeature(feature);
        },

        /**
         * @api {function} VMAP.layers.loadLayer(loadURL,layerId,styleFunction) loadLayer
         * @apiName adds the given layer to the top of the map
         * @apiGroup VMAP layers
         *
         * @apiParam {Object} loadURL loadURL
         * @apiParam {String} layerId layerId
         * @apiParam {Object} styleFunction styleFunction
         *
         */
        loadLayer: function (loadURL, layerId, styleFunction) {
            var source = new ol.source.Vector({
                format: new ol.format.GeoJSON(),
                url: loadURL
            });
            var layer = new ol.layer.Vector({
                source: source,
                style: styleFunction
            });
            layer.set('id', layerId);
            vmap.el.addLayer(layer);
        },
        /**
         * @api {function} VMAP.layers.loadLayerByExtent(loadURL,layerId,styleFunction) loadLayerByExtent
         * @apiName adds the given layer to the top of the map
         * @apiGroup VMAP layers
         *
         * @apiParam {Object} loadURL loadURL
         * @apiParam {String} layerId layerId
         * @apiParam {Object} styleFunction styleFunction
         * @apiParam {String} transform = 'EPSG:505456'
         *
         */
        loadLayerByExtent: function (loadURL, layerId, styleFunction, transform) {
            var source = new ol.source.Vector({
                format: new ol.format.GeoJSON(),
                strategy: ol.loadingstrategy.bbox,
                url: function (extent, resolution, projection) {
                    var newExtent = ol.proj.transformExtent(extent, 'EPSG:3857', 'EPSG:4326');
                    var leftbottomPTV = ol.proj.transform([newExtent[0], newExtent[1]], 'EPSG:4326', transform);
                    var righttopPTV = ol.proj.transform([newExtent[2], newExtent[3]], 'EPSG:4326', transform);
                    //TODO the loadURL should be replaced
                    var url = loadURL + '&coordLeft=' + leftbottomPTV[0] + '&coordBottom=' + leftbottomPTV[1] + '&coordRight=' + righttopPTV[0] + '&coordTop=' + righttopPTV[1];
                    return url;
                }
            });
            var layer = new ol.layer.Vector({
                source: source,
                style: styleFunction
            });
            layer.set('id', layerId);
            vmap.el.addLayer(layer);
        },
        /**
         * @api {function} VMAP.layers.setMapBackground(background) setMapBackground
         * @apiName set the given background layer to the bottom of the map
         * @apiGroup VMAP layers
         *
         * @apiParam {Object} background layer
         *
         */
        setMapBackground: function (background) {
            vmap.el.removeLayer(vmap.backgrounds.active);
            vmap.el.addLayer(background);
            this.moveLayerToBottom(background, false);
            vmap.backgrounds.active = background;
            return background;
        }
    };
    /**
     * @api {subobject} VMAP.controls{} controls
     * @apiName controls
     * @apiGroup VMAP
     */
    this.controls = {
        /**
         * @api {function} VMAP.controls.init(config) init
         * @apiName init controls
         * @apiGroup VMAP controls
         *
         * @apiParam {Object} config
         *
         */
        init: function (config) {
            var controls = ol.control.defaults({
                attribution: false,
                rotate: config.altShiftDragRotate
            });
            if (config.fullScreen) {
                controls.push(new ol.control.FullScreen());
            }
            if (config.overviewMap) {
                controls.push(new ol.control.OverviewMap({
                    collapsed: false
                }));
            }
            if (config.zoomSlider) {
                controls.push(new ol.control.ZoomSlider());
            }
            if (config.scaleLine) {
                controls.push(new ol.control.ScaleLine({
                    units: config.scaleLineUnits
                }));
            }
            if (config.mousePosition) {
                controls.push(new ol.control.MousePosition({
                    projection: config.projection,
                    coordinateFormat: ol.coordinate.createStringXY(config.mousePositionFractionDigits)
                }));
            }
            controls.forEach(function (control) {
                vmap.el.addControl(control);
            });
        }
    };
    /**
     * @api {subobject} VMAP.interactions{} interactions
     * @apiName interactions
     * @apiGroup VMAP
     */
    this.interactions = (function () {
        var globalSelect = new ol.interaction.Select({
            filter: function (feature, layer) {
                if (vmap.events.selectFilter) {
                    return vmap.events.selectFilter.apply(vmap, [feature, layer]);
                }
                return true;
            }
        });
        globalSelect.on('select', function (evt) {
            var features = evt.target.getFeatures();
            vmap.events.fire(vmap.events.eventType.FEATURE_SELECT, features);
        });
        var overlayFeatures = new ol.Collection();

        var Measure = function (type) {
            var measureTooltipElement = undefined;
            var measureTooltip = undefined;
            var measureResult = undefined;
            var draw = new ol.interaction.Draw({
                features: overlayFeatures,
                type: type
            });
            draw.setActive(false);

            function createMeasureTooltip() {
                if (measureTooltipElement) {
                    measureTooltipElement.parentNode
                        .removeChild(measureTooltipElement);
                }
                measureTooltipElement = document.createElement('div');
                measureTooltipElement.className = 'tooltip tooltip-measure';
                measureTooltip = new ol.Overlay({
                    element: measureTooltipElement,
                    offset: [0, -50],
                    positioning: 'bottom-center'
                });
                vmap.el.addOverlay(measureTooltip);
            }
            draw.on('drawstart', function (evt) {
                measureResult = evt.feature;
            }, this);
            draw.on('drawend', function (evt) {
                measureTooltipElement.className = 'tooltip tooltip-static';
                measureTooltip.setOffset([0, -30]);
                measureResult = null;
                measureTooltipElement = null;
                createMeasureTooltip();
            }, this);

            function pointerMoveHandler(evt) {
                if (!draw.getActive()) {
                    return;
                }
                if (evt.dragging) {
                    return;
                }
                var tooltipCoord = evt.coordinate;
                if (measureResult) {
                    var output;
                    var geom = measureResult.getGeometry();
                    if (geom instanceof ol.geom.Polygon) {
                        output = geom.getArea();
                        if (output > 10000) {
                            output = (Math.round(output / 1000000 * 100) / 100) + ' ' + 'km<sup>2</sup>';
                        } else {
                            output = (Math.round(output * 100) / 100) + ' ' + 'm<sup>2</sup>';
                        }
                        tooltipCoord = geom.getInteriorPoint().getCoordinates();
                    } else if (geom instanceof ol.geom.LineString) {
                        output = Math.round(geom.getLength() * 100) / 100;
                        if (output > 100) {
                            output = (Math.round(output / 1000 * 100) / 100) + ' ' + 'km';
                        } else {
                            output = (Math.round(output * 100) / 100) + ' ' + 'm';
                        }
                        tooltipCoord = geom.getLastCoordinate();

                    }
                    measureTooltipElement.innerHTML = output;
                    measureTooltip.setPosition(tooltipCoord);
                }
            }

            return {
                measure: draw,
                init: function () {
                    createMeasureTooltip();
                    vmap.events.on(vmap.events.eventType.MOUSE_MOVE, pointerMoveHandler, this);
                },
                setActive: function (active) {
                    if (active) {
                        draw.setActive(true);
                    } else {
                        draw.setActive(false);
                    }
                }
            }
        };

        var Draw = {
            Point: new ol.interaction.Draw({
                features: overlayFeatures,
                type: 'Point'
            }),
            LineString: new ol.interaction.Draw({
                features: overlayFeatures,
                type: 'LineString'
            }),
            Polygon: new ol.interaction.Draw({
                features: overlayFeatures,
                type: 'Polygon'
            }),
            Modify: new ol.interaction.Modify({
                features: globalSelect.getFeatures()
            }),
            Translate: new ol.interaction.Translate({
                features: globalSelect.getFeatures()
            }),
            Snap: new ol.interaction.Snap({
                features: overlayFeatures
            }),
            MeasureDistance: new Measure('LineString'),
            MeasureArea: new Measure('Polygon')
        };



        return {
            /**
             * @api {function} VMAP.interactions.init() init
             * @apiName init interactions
             * @apiGroup VMAP interactions
             *
             */
            init: function () {
                var overlayLayer = new ol.layer.Vector({
                    source: new ol.source.Vector({
                        features: overlayFeatures,
                        useSpatialIndex: false
                    }),
                    style: vmap.styles.drawStyle
                });
                overlayLayer.setMap(vmap.el);
                vmap.el.addInteraction(globalSelect);
                vmap.el.addInteraction(Draw.Point);
                vmap.el.addInteraction(Draw.LineString);
                vmap.el.addInteraction(Draw.Polygon);
                vmap.el.addInteraction(Draw.MeasureDistance.measure);
                Draw.MeasureDistance.init();
                vmap.el.addInteraction(Draw.MeasureArea.measure);
                Draw.MeasureArea.init();
                vmap.el.addInteraction(Draw.Modify);
                vmap.el.addInteraction(Draw.Translate);
                vmap.el.addInteraction(Draw.Snap);
                for (var key in Draw) {
                    Draw[key].setActive(false);
                }
            },
            /**
             * @api {function} VMAP.interactions.setActive(type,snapped) setActive
             * @apiName active the given draw type
             * @apiGroup VMAP interactions
             *
             * @apiParam {String} type [Point,LineString,Polygon,Modify]
             * @apiParam {Boolean} snapped [true,false]
             *
             */
            setActive: function (type, snapped) {
                for (var key in Draw) {
                    if (key == type) {
                        Draw[key].setActive(true);
                    } else {
                        Draw[key].setActive(false);
                    }
                }
                Draw.Snap.setActive(snapped);
            },
            /**
             * @api {function} VMAP.interactions.getSelect() getSelect
             * @apiName return select
             * @apiGroup VMAP interactions
             *
             */
            getSelect: function () {
                return globalSelect;
            }
        }
    })();
    /**
     * @api {subobject} VMAP.styles{} styles
     * @apiName styles
     * @apiGroup VMAP
     */
    this.styles = {
        drawStyle: new ol.style.Style({
            fill: new ol.style.Fill({
                color: 'rgba(255, 255, 255, 0.2)'
            }),
            stroke: new ol.style.Stroke({
                color: '#2980b9',
                width: 2
            }),
            image: new ol.style.Circle({
                radius: 7,
                fill: new ol.style.Fill({
                    color: '#2980b9'
                })
            })
        }),
        defaultStyle: new ol.style.Style({
            fill: new ol.style.Fill({
                color: 'rgba(255, 255, 255, 0.6)'
            }),
            stroke: new ol.style.Stroke({
                color: '#319FD3',
                width: 1
            }),
            image: new ol.style.Circle({
                radius: 5,
                fill: new ol.style.Fill({
                    color: 'rgba(255, 255, 255, 0.6)'
                }),
                stroke: new ol.style.Stroke({
                    color: '#319FD3',
                    width: 2
                })
            })
        }),
        defaultStyleOptions: {
            fillColor: 'rgba(255, 255, 255, 0.6)',
            fileOpacity: 0.6,
            strokeColor: '#319FD3',
            strokeWidth: 1,
            textFillColor: '#000',
            textStrokeColor: '#fff',
            textStrokeWidth: 3,
            featurePropertyKey: 'name',
            textMaxResolution: 100
        },
        /**
         * @api {function} VMAP.styles.createStyleFunc(styleOptions) createStyleFunc
         * @apiName create a styleFunction
         * @apiGroup VMAP styles
         *
         * @apiParam {Object} styleOptions styleOptions
         *
         */
        createStyleFunc: function (styleOptions) {
            var fillColor_ = styleOptions.fillColor ? styleOptions.fillColor : this.defaultStyleOptions.fillColor;
            var strokeColor_ = styleOptions.strokeColor ? styleOptions.strokeColor : this.defaultStyleOptions.strokeColor;
            var strokeWidth_ = styleOptions.strokeWidth ? styleOptions.strokeWidth : this.defaultStyleOptions.strokeWidth;
            var textFillColor_ = styleOptions.textFillColor ? styleOptions.textFillColor : this.defaultStyleOptions.textFillColor;
            var textStrokeColor_ = styleOptions.textStrokeColor ? styleOptions.textStrokeColor : this.defaultStyleOptions.textStrokeColor;
            var textStrokeWidth_ = styleOptions.textStrokeWidth ? styleOptions.textStrokeWidth : this.defaultStyleOptions.textStrokeWidth;
            var featurePropertyKey_ = styleOptions.featurePropertyKey ? styleOptions.featurePropertyKey : this.defaultStyleOptions.featurePropertyKey;
            var textMaxResolution_ = styleOptions.textMaxResolution ? styleOptions.textMaxResolution : this.defaultStyleOptions.textMaxResolution;
            return function (feature, resolution) {
                var featureProperty = feature.get(featurePropertyKey_);
                featureProperty = featureProperty ? featureProperty : feature.getId()
                var text_ = resolution < textMaxResolution_ ? featureProperty : '';
                var style = new ol.style.Style({
                    fill: new ol.style.Fill({
                        color: fillColor_
                    }),
                    stroke: new ol.style.Stroke({
                        color: strokeColor_,
                        width: strokeWidth_
                    }),
                    image: new ol.style.Circle({
                        radius: 5,
                        fill: new ol.style.Fill({
                            color: 'rgba(255, 255, 255, 0.6)'
                        }),
                        stroke: new ol.style.Stroke({
                            color: '#319FD3',
                            width: 2
                        })
                    }),
                    text: new ol.style.Text({
                        font: '12px Calibri,sans-serif',
                        fill: new ol.style.Fill({
                            color: textFillColor_
                        }),
                        stroke: new ol.style.Stroke({
                            color: textStrokeColor_,
                            width: textStrokeWidth_
                        }),
						offsetY: -15,
                        text: text_
                    })
                });
                return [style];
            }
        },
        /**
         * @api {function} VMAP.styles.createStyleFuncByDBConfig(styleResult) createStyleFuncByDBConfig
         * @apiName create styleFunction by db config
         * @apiGroup VMAP styles
         *
         * @apiParam {String} styleResult styleResult
         *
         */
        createStyleFuncByDBConfig: function (styleResult) {
            if (styleResult == '' || styleResult == 'null') {
                return this.createStyleFunc(this.defaultStyleOptions);
            }
            styleResult = JSON.parse(styleResult);

            function calcRatio(url, size) {
                var image = new Image();
                image.src = url;
                return size / image.height;
            }
            var conditions = styleResult.conditions;
            return function (feature, resolution) {
                var rgb = VMAPUtil.hexToRgb(styleResult.fill.color);
                var opac = styleResult.fill.opacity / 100;
                var fillColor = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + opac + ')';
                var strokeColor = styleResult.stroke.color;
                var iconURL = styleResult.icon_url;
                var iconSize = styleResult.icon_size;
                conditions.forEach(function (condition) {
                    var cs = condition.conditions;
                    cs.forEach(function (c) {
                        if (c.type == 'point' && c.pointicon && c.valuex === feature.get(condition.geomFieldName)) {
                            strokeColor = c.bordercolor;
                            iconURL = c.pointicon;
                            iconSize = c.pointsize;
                        }
                        if (c.type == 'area' && c.valuex === feature.get(condition.geomFieldName)) {
                            strokeColor = c.bordercolor;
                        }
                    });
                });
                var styles = [];
                styles['Polygon'] = [
                    new ol.style.Style({
                        fill: new ol.style.Fill({
                            color: fillColor
                        }),
                        stroke: new ol.style.Stroke({
                            color: strokeColor,
                            width: styleResult.stroke.width
                        }),
                        text: new ol.style.Text({
                            font: styleResult.layerFontSize + 'px ' + styleResult.layerFontType.replace(';', ''),
                            fill: new ol.style.Fill({
                                color: styleResult.layerFontColor
                            }),
                            stroke: new ol.style.Stroke({
                                color: '#444444',
                                width: 2
                            }),
                            offsetX: 15,
                            offsetY: -15,
                            text: feature.get('label') ? feature.get('label') : feature.getId()
                        })
                    })];
                styles['Point'] = styles['Polygon'].concat(
                    new ol.style.Style({
                        image: new ol.style.Icon({
                            src: iconURL,
                            scale: calcRatio(iconURL, iconSize),
                            anchor: [0, 0],
                            anchorXUnits: 'fraction',
                            anchorYUnits: 'fraction',
                            opacity: 1
                        })
                    }));
				styles['MultiPolygon'] = styles['Point'];
                return styles[feature.getGeometry().getType()];
            }
        }
    };
    /**
     * @api {subobject} VMAP.events{} events
     * @apiName events
     * @apiGroup VMAP
     */
    this.events = {
        /**
         * @api vmap.events.eventType
         * @apiName vmap.events.eventType
         * @apiGroup VMAP events
         */
        eventType: {
            FEATURE_SELECT: 'FEATURE_SELECT',
            MAP_CLICK: 'MAP_CLICK',
            MAP_MOVEEND: 'MAP_MOVEEND',
            MOUSE_MOVE: 'MOUSE_MOVE'
        },
        selectFilter: undefined,
        listeners: {},
        /**
         * @api {function} VMAP.events.on(type,listener,opt_this) on
         * @apiName register listener
         * @apiGroup VMAP events
         *
         * @apiParam {String} type vmap.events.eventType
         * @apiParam {Object} listener listener
         * @apiParam {Object} opt_this opt_this
         *
         */
        on: function (type, listener, opt_this) {
            this.listeners[type] = this.listeners[type] || [];
            this.listeners[type].push({
                listener: listener,
                opt_this: opt_this
            });
        },
        /**
         * @api {function} VMAP.events.un(type,listener) un
         * @apiName unregister listener
         * @apiGroup VMAP events
         *
         * @apiParam {String} type vmap.events.eventType
         * @apiParam {Object} listener listener
         *
         */
        un: function (type, listener) {
            var ls = this.listeners[type] || [];
            for (var index = ls.length - 1; index >= 0; index--) {
                if (ls[index].listener == listener) {
                    ls.splice(index, 1);
                    break;
                }
            }
        },
        /**
         * @api {function} VMAP.events.fire(type,listener) fire
         * @apiName fire the type event
         * @apiGroup VMAP events
         *
         * @apiParam {String} type vmap.events.eventType
         * @apiParam {Object} args args
         *
         */
        fire: function (type, args) {
            this.listeners[type] = this.listeners[type] || [];
            this.listeners[type].forEach(function (obj) {
                obj.listener.call(obj.opt_this, args);
            });
        },
		/**
         * @api {function} VMAP.events.init() init
         * @apiName init event
         * @apiGroup VMAP events
         *
         */
		init: function(){
			vmap.events.on(vmap.events.eventType.MAP_MOVEEND, vmap.views.saveRewindPosition, vmap.views);
			vmap.el.on('moveend', function () {
				vmap.events.fire(vmap.events.eventType.MAP_MOVEEND, arguments);
			}, this);
			vmap.el.on('pointermove', function () {
				vmap.events.fire(vmap.events.eventType.MOUSE_MOVE, arguments);
			}, this);
			vmap.el.on('click', function () {
				vmap.events.fire(vmap.events.eventType.MAP_CLICK, arguments);
			}, this);
		}
    };
}
