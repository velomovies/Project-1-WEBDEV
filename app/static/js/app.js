(function () {
  "use strict"

  // console.log = () => {
  //   setTimeout(() => {
  //     document.querySelectorAll('*').forEach((kasa) => {
  //       kasa.style.background = 'red'
  //       kasa.style.borderColor = 'blue'
  //       kasa.style.color = 'yellow'
  //       kasa.style.filter = 'hue-rotate(180deg) grayscale(1) sepia(100%) blur(10px)'
  //     })1
  //   }, 5000) 
  // }
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
          utils.addHidden('.park')
          utils.removeHidden('.loader')
          api.getData(api.queryHome)
          .then(function (data) {
            utils.selectionDate(data)
            render.init(data)
          })
          .then(function () {
            utils.addHidden('.loader')
          })
          .catch(function (error) {
            console.log('catched error: ' + error)
          })
        },
        'park': function () {
          utils.removeHidden('.loader')
          api.getData(api.queryPark, render.active)
          .then(function (data) {
            template.render(data, '#parkInfo', template.park)
            template.render(data, '#images', template.parkImage)
          })
          .then(function () {
            utils.removeHidden('.park')
            utils.addHidden('.loader')
          })
          .catch(function (error) {
            console.log('catched error: ' + error)
          })
        },
        'refreshPark': function () {
          routie('park')
        },
        'refreshHome': function () {
          routie('home')
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
      }
      LIMIT 100`
      // dc:date dc:creator
    }
  }

  const render = {
    init: function (data) {
      let map = L.map('mapid')
      L.tileLayer.provider('CartoDB').addTo(map)
      this.setView(map)
      this.addPoints(map, data)
      render.active.map = map
    }, 
    setView: function (map) {
      map.setView([52.36, 4.888], 12)
    },
    addPoints: function (map, data) {

      let filteredData = data

      if (render.active.selectedDate) {
        if (render.active.selectedDate == "Alles") {
          filteredData = data
        } else {
          filteredData = data.filter(function (item) {
          if (item.date) {
            return item.date.value == render.active.selectedDate
          } else if (render.active.selectedDate == '????') {
            return item
          }
        })
      }
      } else {
        filteredData = data
      }

      filteredData.forEach(function (item) {
        const geojson = Terraformer.WKT.parse(item.wkt.value)
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
      map.setView([(e.latlng.lat - .0002), e.latlng.lng], 24)
      render.active = {
        'uri': e.layer.feature.geometry.uri,
        'date': e.layer.feature.geometry.date,
        'park': e.layer.feature.geometry.name,
        'map': map
      }
      routie(`refreshPark`)
    },
    active: {}
  }

  const template = {
    render: function (data, route, template) {
      Transparency.render(document.querySelector(route), template(data), this.renderDirectives())
    },
    park: function (data) {
      return {
        title: render.active.park,
        date: render.active.date
      }
    },
    parkImage: function (data) {
      const dataImage = data
      .map(function (item) {
        return {
          park: item.title.value,
          imageUrl: item.imgurl.value
        }
      })
      return dataImage
    },
    selectDate: function (data) {
      let dataDate = ['Alles', '????']
      data.forEach(function (item) {
        if(item.date) {
          if(!dataDate.includes(item.date.value)) {
            dataDate.push(item.date.value)
          }    
        }
      })

      let dataDateObj = dataDate.map(function (item) {
        return { 
          date: item
        }
      }) 
      return dataDateObj
    },
    renderDirectives: function () {
      const directives = {
        image: {
          src: function (params) {
            return this.imageUrl
          }
        }
      }
    return directives
    }
  }

  const utils = {
    addHidden: function (select) {
      document.querySelector(select).classList.add('hidden')
    },
    removeHidden: function (select) {
      document.querySelector(select).classList.remove('hidden')
    },
    selectionDate: function (data) {
      document.querySelector('aside svg').addEventListener('click', function () {
        template.render(data, '#selectDate', template.selectDate)
        utils.removeHidden('.selectDate')
        utils.selectionDateLi()
      })
      
    },
    selectionDateLi: function () {
      document.querySelectorAll('aside article ul li').forEach(function (element) {
        element.addEventListener('click', function () {
        render.active.selectedDate = this.innerHTML
        utils.addHidden('.selectDate')
        routie('refreshHome')
      })
    })
    }
  }

  app.init()

})()