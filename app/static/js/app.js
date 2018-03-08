(function () {
  "use strict"

  const app = {
    init: function () {
      location.hash = ''
      // Initialize the app and start router
      router.init()

    }
  }

  const router = {
    init: function () {
      routie({
        'home': function () {
          if(render.active.map) {
            render.active.map.remove()
          }
          console.log('home')
          api.getData(api.queryHome)
          .then(function (data) {
            console.log(data)
            render.init(data)
          })
          .catch(function (error) {
            console.log('catched error: ' + error)
          })
        },
        'park': function () {
          console.log('doe het!', render.active)
          api.getData(api.queryPark, render.active)
          .then(function (data) {
            console.log(data)
            template.render(data, '#park', template.park)
            template.render(data, '#images', template.parkImage)
          })
          .catch(function (error) {
            console.log('catched error: ' + error)
          })
        },
        'refresh': function () {
          routie('park')
        },
        '': function () {
          routie('home')
        }
      })
    }
  }

  const api = {
    getData: function (query, parkLink) {
      return new Promise(function (resolve, reject) {
          // When there is no localStorage and the user has not been at the website before it request the data from the api
          api.requestData(resolve, reject, query, parkLink)
      })

    },
    requestData: function (resolve, reject, query, parkLink) {
      const encodedquery = encodeURIComponent(query(parkLink))
      
      const queryurl = 'https://api.data.adamlink.nl/datasets/AdamNet/all/services/endpoint/sparql?default-graph-uri=&query=' + encodedquery + '&format=application%2Fsparql-results%2Bjson&timeout=0&debug=on';

      const request = new XMLHttpRequest()
    
      request.open('GET', queryurl, true)

      request.onload = function () {
        if (request.status >= 200 && request.status < 400) {
          let data = JSON.parse(request.responseText)
          resolve(data.results.bindings)
        } else {
          reject(error)
        }
      }

      request.onerror = function () {
        routie('#error')
      }

      request.send()
    },
    queryHome: function () {
      return `
      PREFIX dct: <http://purl.org/dc/terms/>
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>
      PREFIX dc: <http://purl.org/dc/elements/1.1/>
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      PREFIX wd: <http://www.wikidata.org/entity/>
      PREFIX wdt: <http://www.wikidata.org/prop/direct/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX sem: <http://semanticweb.cs.vu.nl/2009/11/sem/>
      PREFIX geo: <http://www.opengis.net/ont/geosparql#>
      
      SELECT ?ALstreet ?ALstreetLabel ?date ?wkt WHERE {
        {
          SERVICE <https://query.wikidata.org/sparql> {
            ?park wdt:P31 wd:Q22698  .
            ?park wdt:P131 wd:Q9899 .
          }
          ?ALstreet owl:sameAs ?park .
          ?ALstreet rdfs:label ?ALstreetLabel .
          OPTIONAL {?ALstreet sem:hasEarliestBeginTimeStamp ?date . }
          ?ALstreet geo:hasGeometry ?geo .
          ?geo geo:asWKT ?wkt .
        }
          UNION {
          ?ALstreet rdfs:label ?ALstreetLabel .
          FILTER REGEX(?ALstreetLabel,"park$") .
          OPTIONAL {?ALstreet sem:hasEarliestBeginTimeStamp ?date . }
          ?ALstreet geo:hasGeometry ?geo .
          ?geo geo:asWKT ?wkt .
        }  
          UNION {
          ?ALstreet rdfs:label ?ALstreetLabel .
          FILTER REGEX(?ALstreetLabel,"plantsoen$") .
          OPTIONAL {?ALstreet sem:hasEarliestBeginTimeStamp ?date . }
          ?ALstreet geo:hasGeometry ?geo .
          ?geo geo:asWKT ?wkt .
        }  
      }
      GROUP BY ?ALstreet ?ALstreetLabel ?date ?wkt
      ORDER BY ?date`
    },
    queryPark: function (parkLink) {
      return `
      PREFIX dct: <http://purl.org/dc/terms/>
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>
      PREFIX dc: <http://purl.org/dc/elements/1.1/>
      SELECT ?imgurl ?type ?title WHERE {
        ?bbitem dct:spatial <https://adamlink.nl/geo/${parkLink.uri}> .
        ?bbitem foaf:depiction ?imgurl .
        ?bbitem dc:type ?type .
        ?bbitem dc:title ?title .
      }`
      // dc:date dc:creator
    }
  }

  const render = {
    init: function (data) {
      let map = L.map('mapid')
      L.tileLayer.provider('CartoDB').addTo(map)
      this.setView(map)
      this.addPoints(map, data)
    }, 
    setView: function (map) {
      map.setView([52.37, 4.888], 13)
    },
    addPoints: function (map, data) {
      data.forEach(function (item) {
        const geojson = Terraformer.WKT.parse(item.wkt.value)
        console.log(item)
        geojson.name = item.ALstreetLabel.value
        geojson.uri = item.ALstreet.value.replace('https://adamlink.nl/geo/', '')
        if(item.date) {
          geojson.date = item.date.value
        } else {
          geojson.date = '????'
        }
        L.geoJSON(geojson).addTo(map).on('click', function (e) {
          render.focus(map, e)
        })
      })
    },
    focus: function (map, e) {
      map.panTo(new L.LatLng(e.latlng.lat, e.latlng.lng))
      map.setView([e.latlng.lat, e.latlng.lng], 24)
      console.log(e)
      render.active = {
        'uri': e.layer.feature.geometry.uri,
        'date': e.layer.feature.geometry.date,
        'park': e.layer.feature.geometry.name,
        'map': map
      }
      routie(`refresh`)
    },
    active: {}
  }

  const template = {
    render: function (data, route, template) {
      Transparency.render(document.querySelector(route), template(data), this.renderDirectives())
    },
    park: function (data) {
      console.log(render.active.park)
      return {
        title: render.active.park
      }
    },
    parkImage: function (data) {
      const dataImage = data
      .map(function (item) {
        console.log(item.imgurl.value, render.active)
        return {
          park: item.title.value,
          imageUrl: item.imgurl.value
        }
      })
      return dataImage
    },
    renderDirectives: function () {
      const directives = {
        image: {
          src: function (params) {
            console.log('werkt!')
            return this.imageUrl
          }
        }
      }
    return directives
    }
  }

  app.init()

})()