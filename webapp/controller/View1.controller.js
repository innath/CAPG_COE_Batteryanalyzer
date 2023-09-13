sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, MessageBox) {
        "use strict";

        return Controller.extend("project2.controller.View1", {
            onInit: function () {
                var oUtil = {
                    TotalCount: "0",
                    GRNumber: "",
                    oYear: "",
                    ovisible: true,
                    oeditable: true,
                    ovisibleNav: false
                };
                var X = new sap.ui.model.json.JSONModel(oUtil);
                this.getView().setModel(X, "UtilityModel")
                //added to set year on filter 07/07/2023-pratik
                var oDat = new Date();
                var oDate = oDat.getFullYear();
                this.getView().getModel("UtilityModel").setProperty("/oYear", oDate);

            },
            //To load table data on initial screen loading 04/07/2023 -Pratik
            onLoadTableData: function (val) {
                var that = this;
                var oModel = this.getOwnerComponent().getModel();
                this.oUtilMod = this.getView().getModel("UtilityModel");
                sap.ui.core.BusyIndicator.show();
                var oPath = "/A_MaterialDocumentHeader(MaterialDocumentYear='2023',MaterialDocument='" + val + "')/to_MaterialDocumentItem"
                oModel.read(oPath, {
                    async: false,
                    success: function (odata) {
                        var oTableData = odata.results;
                        var omod = new sap.ui.model.json.JSONModel(oTableData);
                        that.getView().setModel(omod, "MaterialDocument");



                        //adding formula to calculate battery count 04/07/2023-pratik
                        var matData = that.getView().getModel("MaterialDocument");
                        that.matData = matData;
                        for (var j = 0; j < matData.getData().length; j++) {
                            //commented bcoz count always 1
                            //  var cnt = parseFloat(matData.getData()[j].QuantityInEntryUnit) / 625;
                            matData.getData()[j].QuantityCount = 1;
                            that.oIndex = j;

                            var material = matData.getData()[j].Material
                            if (!that.btrigger) {
                                that.onBatryDesc(material);
                            }

                            //added to get supplier description from API 05/07/2023-pratik
                            var oSupId = that.matData.getProperty("/" + that.oIndex + "/Supplier");
                            var oBuzPath = "/C_BusinessPartner(BusinessPartner='" + oSupId + "',DraftUUID=guid'00000000-0000-0000-0000-000000000000',IsActiveEntity=true)";
                            that.getOwnerComponent().getModel("BzinesSrv").read(oBuzPath, {
                                async: false,
                                success: function (odata) {
                                    var odesc = odata.BusinessPartnerName;
                                    that.oUtilMod.setProperty("/Supplier", that.matData.getProperty("/" + that.oIndex + "/Supplier") + " " + odesc);
                                    sap.ui.core.BusyIndicator.hide();
                                },
                                error: function (oerror) {

                                }
                            });


                        }
                        matData.refresh();
                        //added logic to set total count on screen 04/07/2023-pratik

                        that.oUtilMod.setProperty("/TotalCount", oTableData.length);
                        //   sap.ui.core.BusyIndicator.hide();
                    },
                    error: function (oerror) {

                    }
                });
            },
            //value enter in filter options, will process here
            onSearch: function (evt) {
                var oVal = evt.getSource().getFilterGroupItems()[1].getControl().getValue();
                //to retrive data from backend 04/07/2023-pratik
                if (oVal !== "") {
                    this.onLoadTableData(oVal);
                } else {
                    MessageBox.warning("Please enter goods receipt first");
                }

                //   this.getView().getModel("UtilityModel").setProperty("/GRNumber",oVal);
            },
            onPressConfirm: function (evt) {
                MessageBox.confirm(
                    'Do you want submit? ',
                    {
                        icon: MessageBox.Icon.WARNING,
                        title: "Confirm",
                        actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                        initialFocus: MessageBox.Action.YES,
                        onClose: function (oaction) {
                            if (oaction === MessageBox.Action.YES) {
                                // Do something
                                // var oRouter = this.getOwnerComponent().getRouter();
                                //oRouter.navTo("RouteOutput");
                                this.onSendData();
                            }
                        }.bind(this)
                    }
                );

            },
            onSendData: function () {
                var oModel = this.getOwnerComponent().getModel();
                var oMatData = this.getView().getModel("MaterialDocument");
                var oStLoc = this.getView().getModel("UtilityModel");
                var dateFormat = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "yyyy-MM-dd" });
                var oDate = new Date();
                var dateFormatted = dateFormat.format(oDate);
                if (oMatData) {
                    if (oStLoc.getProperty("/STLoc")) {
                        var oSetData = oMatData.getData();
                        var oMatData = []
                        for (var i = 0; i < oSetData.length; i++) {
                            var x = {
                                "Material": oSetData[i].Material.split(" ")[0],
                                "Plant": oSetData[i].Plant,
                                "StorageLocation": oSetData[i].StorageLocation,
                                "GoodsMovementType": "311",
                                "Batch": oSetData[i].Batch,
                                "EntryUnit": oSetData[i].EntryUnit,
                                "QuantityInEntryUnit": oSetData[i].QuantityInEntryUnit,
                                "IssuingOrReceivingStorageLoc": oSetData[i].IssuingOrReceivingStorageLoc,
                                "MaterialDocumentItemText": oSetData[i].MaterialDocumentItemText,
                                "IssuingOrReceivingPlant": oSetData[i].Plant
                            }
                            oMatData.push(x);

                        }
                        //calling this to send batry count
                        //start
                        //to count secondary and recycle batry
                        const aCount = new Map([...new Set(oMatData)].map(
                            x => [x.IssuingOrReceivingStorageLoc, oMatData.filter(y => y.IssuingOrReceivingStorageLoc === x.IssuingOrReceivingStorageLoc).length]
                        ));
                        var secodaryCount, recycleCount;
                        if (aCount.get("SL01")) {
                            secodaryCount = aCount.get("SL01").toString();
                        } else {
                            secodaryCount = "0";
                        }
                        if (aCount.get("RC01")) {
                            recycleCount = aCount.get("RC01").toString();
                        } else {
                            recycleCount = "0"
                        }
                        var oPurchaseOrder = oStLoc.getProperty("/PurchaseOrder");
                        var oPayload2 = {
                            "PurchaseOrder": oPurchaseOrder,
                            "SecondaryBatteryCount": secodaryCount,
                            "RecycledBatteryCount": recycleCount
                        }
                        // var oPayload2 = {
                        //     "PurchaseOrder": oPurchaseOrder,
                        //      "SecondaryBatteryCount":"2",
                        //     "RecycledBatteryCount":"5"
                        // }

                        var omod = this.getOwnerComponent().getModel("BtrySorting");
                        //  var opath="/ZC_GCE_EOLBTRYSORTING(PurchaseOrder='"+oPurchaseOrder+"')"
                        omod.create("/ZC_GCE_EOLBTRYSORTING", oPayload2, {
                            success: function (odata) {
                                var a = odata;
                            },
                            error: function (oerr) {
                                var e = oerr;
                            }
                        })
                        //end

                        //calling to send voltage life data
                        //start
                        var oPayload = {
                            "PostingDate": dateFormatted + "T00:00:00",
                            "GoodsMovementCode": "04",
                            "to_MaterialDocumentItem": oMatData
                        }
                        var that = this;
                        oModel.create("/A_MaterialDocumentHeader", oPayload, {
                            success: function (odata) {
                                sap.m.MessageToast.show("Posted successfully.");
                                var oMatdata = that.getView().getModel("MaterialDocument");

                                var oUtil = that.getView().getModel("UtilityModel");

                                for (var i = 0; i < oMatdata.getData().length; i++) {
                                    // oMatdata.setProperty("/"+i+"/oStLoc", oUtil.getProperty("/STLoc"));
                                    oMatdata.setProperty("/" + i + "/MaterialDocument", odata.MaterialDocument);
                                }

                                that.onVisibleField();
                            },
                            error: function (oerror) {
                                var oerr = JSON.parse(oerror.responseText);

                                MessageBox.error(oerr.error.message.value);
                                //  sap.m.MessageToast.show("Not posted.");
                            }
                        });
                        //end
                    } else {
                        MessageBox.warning("Please do voltage life calculation first.")
                    }
                } else {

                    MessageBox.warning("Search Data First");
                }



            },
            //added to calculate voltage life from backend
            onVoltLife: function (evt) {
                //00000000000000000060
                var that = this;
                var oval = evt.getSource().getValue()
                var oModel = this.getView().getModel("MaterialDocument")
                var ocell = evt.getSource().getParent().getAggregation("cells");
                if (evt.getSource().getName() === 'MatCurrent') {
                    evt.getSource().setValue(oval);
                } else if (evt.getSource().getName() === 'MatSOH') {
                    evt.getSource().setValue(oval);
                }
                var oVolt = ocell[4];
                var ocurrent = ocell[5];
                var oSoh = ocell[6];
                var oValidate = this.onValidateCalculation(oVolt, ocurrent, oSoh);

                this.oindex = evt.getSource().getParent().getBindingContextPath();


                if (oValidate) {
                    if (oVolt.getValue() !== "" && ocurrent.getValue() !== "" && oSoh.getValue() !== "") {
                        var oPat = "/ZBTRY_LIFE_CLASS(p_InputVoltage='" + oVolt.getValue() + "',p_Current='" + ocurrent.getValue() + "',p_soh='" + oSoh.getValue() + "')/Set"; //new
                        // var oPat = "/ZBTRY_LIFE_CLASS(p_InputVoltage='55',p_Current='30',p_soh='25')/Set"; //for test 
                        var omod = this.getOwnerComponent().getModel("BtryLife");
                        omod.read(oPat, {
                            success: function (odata) {
                                var omod = odata.results[0];
                                var oVoltLife = omod.voltage_life_to.replace(/^0+/, '');
                                var oStorageLoc = omod.lgort;
                                var oMatModel = that.getView().getModel("MaterialDocument");
                                // var currentVal= that.getView().getModel("UtilityModel").getProperty("/Current");
                                // var sohVal= that.getView().getModel("UtilityModel").getProperty("/SOH");
                                //  that.getView().getModel("MaterialDocument").setProperty(that.oindex + "/MaterialDocumentItemText", oVoltLife);
                                that.getView().getModel("UtilityModel").setProperty("/STLoc", oStorageLoc);
                                oMatModel.setProperty(that.oindex + "/oStLoc", oStorageLoc);

                                oMatModel.setProperty(that.oindex + "/IssuingOrReceivingStorageLoc", oStorageLoc);
                                //  oMatModel.setProperty(that.oindex + "/IssuingOrReceivingPlant", oStorageLoc);
                                // that.getView().getModel("MaterialDocument").refresh(true);
                            },
                            error: function (oerror) {

                            }
                        });
                    } else {
                        MessageBox.warning("Please enter Voltage Life/Current/SOH.")
                    }
                }


            },
            onVisibleField: function () {
                var oUtil = this.getView().getModel("UtilityModel");
                oUtil.setProperty("/ovisible", false);
                oUtil.setProperty("/ovisibleNav", true);
                oUtil.setProperty("/oeditable", false);
            },
            onBack: function () {
                var oUtil = this.getView().getModel("UtilityModel");
                oUtil.setProperty("/ovisible", true);
                oUtil.setProperty("/ovisibleNav", false);
                oUtil.setProperty("/oeditable", true);
                // this.getView().getModel().removeBinding()
                //this.getView().getModel().destroy();
                history.go(0);
                //window.top.location = window.top.location;
            },
            onValidateCalculation: function (oVolt, ocurrent, oSoh) {
                var validateCurrent = true;
                if (parseInt(oVolt.getValue()) <= 74) {
                    if (parseInt(ocurrent.getValue()) < 30) {
                        MessageBox.warning("Please enter current between 30 to 50");
                        validateCurrent = false;
                    } else if (parseInt(ocurrent.getValue()) > 50) {
                        MessageBox.warning("Please enter current between 30 to 50");
                        validateCurrent = false;
                    }
                    if (parseInt(oSoh.getValue()) > 60) {
                        MessageBox.warning("Please enter SOH between 0 to 60");
                        validateCurrent = false;
                    }
                } else if (parseInt(oVolt.getValue()) > 74) {
                    if (parseInt(ocurrent.getValue()) < 50) {
                        MessageBox.warning("Please enter current between 50 to 90");
                        validateCurrent = false;
                    } else if (parseInt(ocurrent.getValue()) > 90) {
                        MessageBox.warning("Please enter current between 50 to 90");
                        validateCurrent = false;
                    }
                    if (parseInt(oSoh.getValue()) < 60) {
                        MessageBox.warning("Please enter SOH between 60 to 100");
                        validateCurrent = false;
                    } else if (parseInt(oSoh.getValue()) > 100) {
                        MessageBox.warning("Please enter SOH between 60 to 100");
                        validateCurrent = false;
                    }
                } else {
                    validateCurrent = true
                }
                return validateCurrent;
            },
            onBatryDesc: function (evt) {
                this.btrigger = true;
                var that = this;
                //added to get battery type description from API 05/07/2023-pratik
                var oDescPath = "/A_ProductDescription(Product='" + evt + "',Language='EN')";
                this.getOwnerComponent().getModel("DescSrv").read(oDescPath, {
                    async: false,
                    success: function (odata) {
                        // that.btrigger=true;
                        var odesc = odata;
                        that.oUtilMod.setProperty("/ProdDesc", odesc.ProductDescription);
                        that.matData.getData().forEach(function (item, oindex) {

                            that.matData.setProperty("/" + oindex + "/Material", item.Material + " " + that.oUtilMod.getProperty("/ProdDesc"));
                            that.oUtilMod.setProperty("/PurchaseOrder", item.PurchaseOrder);
                            that.oUtilMod.setProperty("/Supplier", item.Supplier);
                        });


                        // btrigger=false;
                    },
                    error: function (oerror) {

                    }
                });
            }








        });
    });
