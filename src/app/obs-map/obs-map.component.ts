import { Component, OnInit, OnDestroy } from '@angular/core';
import { tileLayer, latLng, marker, Marker } from 'leaflet';
import { ObservationService } from '../services/observation.service';
import { NgxSpinnerService } from 'ngx-spinner';
import * as _ from "lodash";

import 'leaflet.markercluster';
import { FilterService } from '../services/filter.service';
const L = window['L'];

@Component({
  selector: 'app-obs-map',
  templateUrl: './obs-map.component.html',
  styleUrls: ['./obs-map.component.scss']
})
export class ObsMapComponent implements OnInit {
  filter: any = {};
  observations: any;
  noObs: boolean;
  nbFilterSelected: any;
  obsLoaded: boolean;
  mymap;
  validator = {
    photoSelect: false,
    grpSimpleSelect: false,
    grpTaxoSelect: false,
    especeSelect: false,
    userId: null,
    userRole: null,
    isValidator: false,
    validationFilter: false
  }
  userChecked: boolean = false;
  mySubscription;

  mbUrl = 'https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}';
  mbAttr = 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
    '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
    'Imagery © <a href="http://mapbox.com">Mapbox</a>'


  constructor(private spinner: NgxSpinnerService,
    private observationService: ObservationService,
    private filterService: FilterService) { }

  ngOnInit() {
    this.mySubscription = this.filterService.getFilter().subscribe(
      (filter) => {
        if (filter != 'init') {
          this.filter = filter;
          if (this.filter)
            this.getObs(this.filter)
          else {
            this.getObs()
          }
        }
      })
  }

  getObs(filter?) {
    this.spinner.show();
    this.obsLoaded = false;
    let obsFilter = {
      "filtreStatutValidation": "5",
    }
    if (filter) {
      if (!filter.idUtilisateur)
        this.filter.filtreStatutValidation = '5';
      filter = _.omitBy(filter, _.isNil);
      this.nbFilterSelected = _.size(filter);
      if (!filter.idUtilisateur)
        this.nbFilterSelected--;
      if (filter.idUtilisateur == false)
        this.nbFilterSelected--;
      this.filterService.setFilterNotifications(this.nbFilterSelected)

      Object.keys(filter).forEach(function (key) {
        if (key == 'cdSig')
          filter[key] = filter[key].cd_sig_ref
        if (key == 'pseudo')
          filter[key] = filter[key].pseudo
        if (key == 'taxon')
          filter[key] = filter[key].cd_nom[0]
      });

      obsFilter = filter
    }
    else {
      this.filterService.setFilterNotifications(0)
    }
    this.observationService.getMapObservations(obsFilter)
      .subscribe(
        (obs) => {
          if (!obs) {
            console.log("no obs");
            this.noObs = true;
          }
          else {
            this.noObs = false;
            this.observations = obs;
          }
        },
        (error) => console.log("getObservationsErr", error),
        () => {
          if (this.mymap != undefined || this.mymap != null) {
            this.mymap.remove();
          }
          this.mymap = L.map('mapid').setView([46.227638, 2.213749], 6);
          var street = L.tileLayer(this.mbUrl, {
            attribution: this.mbAttr,
            maxZoom: 18,
            id: 'mapbox.streets',
            accessToken: 'pk.eyJ1IjoiYW1pbmVoYW1vdWRhIiwiYSI6ImNqM3dwYmdqdTAwMG8zMnBrNms0NG1pNDYifQ.odRR1wKtv3NpwNy3fsp5yw'
          }).addTo(this.mymap);
          var satellite = L.tileLayer(this.mbUrl, {
            attribution: this.mbAttr,
            maxZoom: 18,
            id: 'mapbox.satellite',
            accessToken: 'pk.eyJ1IjoiYW1pbmVoYW1vdWRhIiwiYSI6ImNqM3dwYmdqdTAwMG8zMnBrNms0NG1pNDYifQ.odRR1wKtv3NpwNy3fsp5yw'
          })
          var baseLayers = {
            "Satellite": satellite,
            "Streets": street
          };
          L.control.layers(baseLayers).addTo(this.mymap);

          if (this.observations) {
            var markersList = L.markerClusterGroup();
            _.forEach(this.observations.observations, (element) => {
              markersList.addLayer(L.marker([element.Y, element.X], { id: element.idData }))
            });


            markersList.on("click", (event) => {
              markersList.unbindPopup()

              this.observationService.getObsByID(event.layer.options.id).subscribe(
                (obs) => {
                  let customPopup = '<div class="img-inner"> <a href="/#/observations/detail/' + obs.idData + '"> <img class="img-popUp" src="' + obs.photos[0].thumbnailFileUri + '"> </a> </div>'
                    + '<div class="leflet-container"><div class="leflet-pop">'
                    + '<a href="/#/profil/' + obs.idUtilisateur + '"><img src="' + obs.avatar + '" class="img-pop-leflet"><p class="pseudo-leflet"> </a> '
                    + obs.pseudo + '</p> </div>'
                    + '<div class="leflet-list">'
                    + '<p  class="leflet-groupSimple">' + obs.lbGroupSimple + '</p>'
                    + '<p class="leflet-groupOP"  >' + obs.lbGroupOP + '</p>'
                    + '<p class="leflet-espece" >' + obs.nomCompletHtml + '</p></div></div></div>'
                    + ' <a class="badge badge-pill badge-secondary leflet-detail" href="/#/observations/detail/' + obs.idData + '"><span class="icon-more_on"></span></a>'
                  let customOptions =
                  {
                    'className': 'custom'
                  }
                  markersList.bindPopup(customPopup, customOptions).openPopup(event.latlng)
                }
              )

            });
            this.mymap.addLayer(markersList);
            this.obsLoaded = true;
            this.spinner.hide();
          }
          else {
            this.spinner.hide();
          }
        }
      )
  }



  getCurrentUser(currentUser) {
    this.userChecked = true;
    if (currentUser) {

      this.validator.userId = currentUser.attributes.ID_UTILISATEUR;
      this.filterService.setFilterNotifications(1);
      this.filter = { 'idUtilisateur': this.validator.userId };
      this.getObs(this.filter);
      let roles = currentUser.attributes.GROUPS.split(",");
      if (_.includes(roles, 'IE_VALIDATOR_PHOTO')) {
        this.validator.photoSelect = true;
        this.validator.userRole = 'IE_VALIDATOR_PHOTO'
      }
      if (_.includes(roles, 'IE_VALIDATOR_GRSIMPLE')) {
        this.validator.grpSimpleSelect = true;
        this.validator.userRole = 'IE_VALIDATOR_GRSIMPLE'
      }
      if (_.includes(roles, 'IE_VALIDATOR_GROPE')) {
        this.validator.grpTaxoSelect = true;
        this.validator.userRole = 'IE_VALIDATOR_GROPE'
      }
      if (_.includes(roles, 'IE_VALIDATOR_EXPERT')) {
        this.validator.especeSelect = true;
        this.validator.userRole = 'IE_VALIDATOR_EXPERT'
      }
      if (_.includes(roles, 'IE_VALIDATOR_PHOTO') || _.includes(roles, 'IE_VALIDATOR_GRSIMPLE') ||
        _.includes(roles, 'IE_VALIDATOR_GROPE') || _.includes(roles, 'IE_VALIDATOR_EXPERT'))
        this.validator.isValidator = true;
    }
    else
      this.getObs()
  }

  ngOnDestroy() {
    this.filterService.setFilter('init');
    this.observations = null;
    if (this.mySubscription)
      this.mySubscription.unsubscribe();
  }
}
