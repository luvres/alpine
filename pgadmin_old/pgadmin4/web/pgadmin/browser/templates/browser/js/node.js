define(
    ['jquery', 'underscore', 'underscore.string', 'pgadmin', 'pgadmin.browser.menu',
     'backbone', 'alertify', 'pgadmin.browser.datamodel', 'backform',
     'pgadmin.backform', 'wcdocker', 'pgadmin.alertifyjs'],
function($, _, S, pgAdmin, Menu, Backbone, Alertify, pgBrowser, Backform) {

  var wcDocker = window.wcDocker;

  // It has already been defined.
  // Avoid running this script again.
  if (pgBrowser.Node)
    return pgBrowser.Node;

  pgBrowser.Nodes = pgBrowser.Nodes || {};

  // A helper (base) class for all the nodes, this has basic
  // operations/callbacks defined for basic operation.
  pgBrowser.Node = function() {};

  // Helper function to correctly set up the property chain, for subclasses.
  // Uses a hash of class properties to be extended.
  //
  // It is unlikely - we will instantiate an object for this class.
  // (Inspired by Backbone.extend function)
  pgBrowser.Node.extend = function(props) {
    var parent = this;
    var child;

    // The constructor function for the new subclass is defined to simply call
    // the parent's constructor.
    child = function(){ return parent.apply(this, arguments); };

    // Add static properties to the constructor function, if supplied.
    _.extend(child, parent, _.omit(props, 'callbacks'));

    // Make sure - a child have all the callbacks of the parent.
    child.callbacks = _.extend({}, parent.callbacks, props.callbacks);

    var bindToChild = function(cb) {
          if (typeof(child.callbacks[cb]) == 'function') {
            child.callbacks[cb] = child.callbacks[cb].bind(child);
          }
        },
        callbacks = _.keys(child.callbacks);
    for(var idx = 0; idx < callbacks.length; idx++) bindToChild(callbacks[idx]);

    // Registering the node by calling child.Init(...) function
    child.Init.apply(child);

    // Initialize the parent
    this.Init.apply(child);

    return child;
  };

  _.extend(pgAdmin.Browser.Node, Backbone.Events, {
    // Node type
    type: undefined,
    // Label
    label: '',
    // Help pages
    sqlAlterHelp: '',
    sqlCreateHelp: '',
    dialogHelp: '',

    title: function(d) {
      return o.label + (d ? (' - ' + d.label) : '');
    },
    hasId: true,
    ///////
    // Initialization function
    // Generally - used to register the menus for this type of node.
    //
    // Also, look at pgAdmin.Browser.add_menus(...) function.
    //
    // NOTE: Override this for each node for initialization purpose
    Init: function() {
      var self = this;
      if (self.node_initialized)
        return;
      self.node_initialized = true;

      pgAdmin.Browser.add_menus([{
        name: 'refresh', node: self.type, module: self,
        applies: ['object', 'context'], callback: 'refresh',
        priority: 1, label: '{{ _("Refresh...") }}',
        icon: 'fa fa-refresh'
      }]);

      if (self.canEdit) {
        pgAdmin.Browser.add_menus([{
        name: 'show_obj_properties', node: self.type, module: self,
        applies: ['object', 'context'], callback: 'show_obj_properties',
        priority: 999, label: '{{ _("Properties...") }}',
        data: {'action': 'edit'}, icon: 'fa fa-pencil-square-o'
      }]);
      }

      if (self.canDrop) {
        pgAdmin.Browser.add_menus([{
          name: 'delete_object', node: self.type, module: self,
          applies: ['object', 'context'], callback: 'delete_obj',
          priority: 2, label: '{{ _("Delete/Drop") }}',
          data: {'url': 'drop'}, icon: 'fa fa-trash',
          enable: _.isFunction(self.canDrop) ?
            function() {
              return !!(self.canDrop.apply(self, arguments));
            } : (!!self.canDrop)
        }]);
        if (self.canDropCascade) {
          pgAdmin.Browser.add_menus([{
            name: 'delete_object_cascade', node: self.type, module: self,
            applies: ['object', 'context'], callback: 'delete_obj',
            priority: 3, label: '{{ _("Drop Cascade") }}',
            data: {'url': 'delete'}, icon: 'fa fa-trash',
            enable: _.isFunction(self.canDropCascade) ?
              function() { return self.canDropCascade.apply(self, arguments); } : (!!self.canDropCascade)
          }]);
        }
      }

      // show query tool only in context menu of supported nodes.
      if (pgAdmin.DataGrid && pgAdmin.unsupported_nodes) {
        if (_.indexOf(pgAdmin.unsupported_nodes, self.type) == -1) {
          pgAdmin.Browser.add_menus([{
            name: 'show_query_tool', node: self.type, module: self,
            applies: ['context'], callback: 'show_query_tool',
            priority: 998, label: '{{ _("Query Tool...") }}',
            icon: 'fa fa-bolt'
          }]);
        }
      }

      // This will add options of scripts eg:'CREATE Script'
      if (self.hasScriptTypes && _.isArray(self.hasScriptTypes)
        &&  self.hasScriptTypes.length > 0) {
          // For each script type create menu
          _.each(self.hasScriptTypes, function(stype) {

            var type_label = S(
                "{{ _("%s Script") }}"
                ).sprintf(stype.toUpperCase()).value(),
              stype = stype.toLowerCase();

            // Adding menu for each script type
            pgAdmin.Browser.add_menus([{
              name: 'show_script_' + stype, node: self.type, module: self,
              applies: ['object', 'context'], callback: 'show_script',
              priority: 4, label: type_label, category: 'Scripts',
              data: {'script': stype}, icon: 'fa fa-pencil',
              enable: self.check_user_permission
            }]);
          });
      }
    },
    ///////
    // Checks if Script Type is allowed to user
    // First check if role node & create role allowed
    // Otherwise test rest of database objects
    // if no permission matched then do not allow create script
    ///////
    check_user_permission: function(itemData, item, data) {
      // Do not display CREATE script on server group and server node
      if (itemData._type == 'server-group' || itemData._type == 'server') {
        return false;
      }
      var node = pgBrowser.Nodes[itemData._type],
        parentData = node.getTreeNodeHierarchy(item);
      if ( _.indexOf(['create','insert','update', 'delete'], data.script) != -1) {
        if (itemData.type == 'role' &&
          parentData.server.user.can_create_role) {
          return true;
        } else if (
           (
            parentData.server && (
            parentData.server.user.is_superuser ||
            parentData.server.user.can_create_db)
           ) ||
           (
            parentData.schema && parentData.schema.can_create
           )
           ) {
            return true;
        } else {
           return false;
        }
      } else {
        return true;
      }
    },
    ///////
    // Generate a Backform view using the node's model type
    //
    // Used to generate view for the particular node properties, edit,
    // creation.
    getView: function(item, type, el, node, formType, callback, ctx, cancelFunc) {
      var that = this;

      if (!this.type || this.type == '')
        // We have no information, how to generate view for this type.
        return null;

      if (this.model) {
        // This will be the URL, used for object manipulation.
        // i.e. Create, Update in these cases
        var urlBase = this.generate_url(item, type, node, false);

        if (!urlBase)
          // Ashamed of myself, I don't know how to manipulate this
          // node.
          return null;

        var attrs = {};

        // In order to get the object data from the server, we must set
        // object-id in the model (except in the create mode).
        if (type !== 'create') {
          attrs[this.model.idAttribute || this.model.prototype.idAttribute ||
            'id'] = node._id;
        }

        // We know - which data model to be used for this object.
        var info = this.getTreeNodeHierarchy.apply(this, [item]),
            newModel = new (this.model.extend({urlRoot: urlBase})) (
                attrs, {node_info: info}
                ),
            fields = Backform.generateViewSchema(
                info, newModel, type, this, node
                );

        if (type == 'create' || type == 'edit') {

          if (callback && ctx) {
              callback = callback.bind(ctx);
          } else {
            callback = function() {
              console.log("Broke something!!! Why we don't have the callback or the context???");
            };
          }

          var onSessionInvalid = function(msg) {

            if(!_.isUndefined(that.statusBar)) {
              that.statusBar.html(msg).css("visibility", "visible");
            }
            callback(true);

            return true;
          };

          var onSessionValidated =  function(sessHasChanged) {

            if(!_.isUndefined(that.statusBar)) {
              that.statusBar.empty().css("visibility", "hidden");
            }

            callback(false, sessHasChanged);
          };

          callback(false, false);

          newModel.on('pgadmin-session:valid', onSessionValidated);
          newModel.on('pgadmin-session:invalid', onSessionInvalid);
        }
        // 'schema' has the information about how to generate the form.
        if (_.size(fields)) {
          // This will contain the actual view
          var view;

          if (formType == 'fieldset') {
            // It is used to show, edit, create the object in the
            // properties tab.
            view = new Backform.Fieldset({
              el: el, model: newModel, schema: fields
            });
          } else {
            // This generates a view to be used by the node dialog
            // (for create/edit operation).
            view = new Backform.Dialog({
              el: el, model: newModel, schema: fields
            });
          }

          if (!newModel.isNew()) {
            // This is definetely not in create mode
            var msgDiv = '<div class="alert alert-info pg-panel-message pg-panel-properties-message">'+
                pgBrowser.messages['LOADING_MESSAGE']+'</div>',
                $msgDiv = $(msgDiv);
            var timer = setTimeout(function(ctx) {
              // notify user if request is taking longer than 1 second

              if (!_.isUndefined(ctx)) {
                $msgDiv.appendTo(ctx);
              }
            }, 1000, ctx);
            newModel.fetch()
            .success(function(res, msg, xhr) {
              // clear timeout and remove message
              clearTimeout(timer);
              $msgDiv.addClass('hidden');

              // We got the latest attributes of the
              // object. Render the view now.
              view.render();
              if (type != 'properties') {
                $(el).focus();
              }
              newModel.startNewSession();
            })
            .error(function(xhr, error, message) {
              var _label = that && item ?
                            that.getTreeNodeHierarchy(
                              item
                            )[that.type].label : '';
              pgBrowser.Events.trigger(
                'pgadmin:node:retrieval:error', 'properties',
                xhr, error, message, item
              );
              if (
                !Alertify.pgHandleItemError(
                  xhr, error, message, {item: item, info: info}
                )
              ) {
                Alertify.pgNotifier(
                  error, xhr,
                  S(
                    "{{ _("Error retrieving properties - %s") }}"
                  ).sprintf(message || _label).value(),
                  function() {
                    console.log(arguments);
                  }
                );
              }
              // Close the panel (if couldn't fetch properties)
              if (cancelFunc) {
                cancelFunc();
              }
            });
          } else {
            // Yay - render the view now!
            $(el).focus();
            view.render();
            newModel.startNewSession();
          }
        }
        return view;
      }

      return null;
    },
    register_node_panel: function() {
      var w = pgBrowser.docker,
        p = w.findPanels('node_props');

      if (p && p.length == 1)
        return;

      var events = {};
      events[wcDocker.EVENT.RESIZE_ENDED] = function() {
        var $container = this.$container.find('.obj_properties').first(),
            v = $container.data('obj-view');

        if (v && v.model && v.model) {
          v.model.trigger(
            'pg-browser-resized', {
              'view': v, 'panel': this, 'container': $container
          });

        }
      };

      p = new pgBrowser.Panel({
          name: 'node_props',
          showTitle: true,
          isCloseable: true,
          isPrivate: true,
          elContainer: true,
          content: '<div class="obj_properties"><div class="alert alert-info pg-panel-message">{{ _('Please wait while we fetch information about the node from the server!') }}</div></div>',
          onCreate: function(myPanel, $container) {
            $container.addClass('pg-no-overflow');
          },
          events: events
      });
      p.load(pgBrowser.docker);
    },
    /*
     * Default script type menu for node.
     *
     * Override this, to show more script type menus (e.g hasScriptTypes: ['create', 'select', 'insert', 'update', 'delete'])
     *
     * Or set it to empty array to disable script type menu on node (e.g hasScriptTypes: [])
     */
    hasScriptTypes: ['create'],
    /******************************************************************
     * This function determines the given item is editable or not.
     *
     * Override this, when a node is not editable.
     */
    canEdit: true,
    /******************************************************************
     * This function determines the given item is deletable or not.
     *
     * Override this, when a node is not deletable.
     */
    canDrop: false,
    /************************************************************************
     * This function determines the given item and children are deletable or
     * not.
     *
     * Override this, when a node is not deletable.
     */
    canDropCascade: false,
    // List of common callbacks - that can be used for different
    // operations!
    callbacks: {
      /******************************************************************
       * This function allows to create/edit/show properties of any
       * object depending on the arguments provided.
       *
       * args must be a object containing:
       *   action - create/edit/properties
       *   item   - The properties of the item (tree ndoe item)
       *
       * NOTE:
       * if item is not provided, the action will be done on the
       * currently selected tree item node.
       *
       **/
      show_obj_properties: function(args, item) {
        var t = pgBrowser.tree,
          i = args.item || item || t.selected(),
          d = i && i.length == 1 ? t.itemData(i) : undefined
          o = this,
          l = o.title.apply(this, [d]);

        // Make sure - the properties dialog type registered
        pgBrowser.Node.register_node_panel();

        // No node selected.
        if (!d)
          return;

        var self = this,
            isParent = (_.isArray(this.parent_type) ?
              function(d) {
                return (_.indexOf(self.parent_type, d._type) != -1);
              } : function(d) {
                return (self.parent_type == d._type);
              }),
            addPanel = function() {
              var d = window.document,
                  b = d.body,
                  el = d.createElement('div');

              d.body.insertBefore(el, d.body.firstChild);

              var pW = screen.width < 800 ? '95%' : '500px',
                  pH = screen.height < 600 ? '95%' : '550px';
                  w = pgAdmin.toPx(el, self.width || pW, 'width', true),
                  h = pgAdmin.toPx(el, self.height|| pH, 'height', true),
                  x = (b.offsetWidth - w) / 2,
                  y = (b.offsetHeight - h) / 2;

              p = pgBrowser.docker.addPanel(
                'node_props', wcDocker.DOCK.FLOAT, undefined,
                {w: w + 'px', h: h + 'px', x: x + 'px', y: y + 'px'}
              );

              b.removeChild(el);
              delete(el);

              return p;
            };

        if (args.action == 'create') {
          // If we've parent, we will get the information of it for
          // proper object manipulation.
          //
          // You know - we're working with RDBMS, relation is everything
          // for us.
          if (self.parent_type && !isParent(d)) {
            // In browser tree, I can be under any node, But - that
            // does not mean, it is my parent.
            //
            // We have some group nodes too.
            //
            // i.e.
            // Tables, Views, etc. nodes under Schema node
            //
            // And, actual parent of a table is schema, not Tables.
            while (i && t.hasParent(i)) {
              i = t.parent(i);
              pd = t.itemData(i);

              if (isParent(pd)) {
                // Assign the data, this is my actual parent.
                d = pd;
                break;
              }
            }
          }

          // Seriously - I really don't have parent data present?
          //
          // The only node - which I know - who does not have parent
          // node, is the Server Group (and, comes directly under root
          // node - which has no parent.)
          if (!d || (this.parent_type != null && !isParent(d))) {
            // It should never come here.
            // If it is here, that means - we do have some bug in code.
            return;
          }

          if (!d)
            return;

          l = S('{{ _("Create - %s") }}').sprintf(
              [this.label]).value();
          p = addPanel();

          setTimeout(function() {
            o.showProperties(i, d, p, args.action);
          }, 10);
        } else {
          if (pgBrowser.Node.panels && pgBrowser.Node.panels[d.id] &&
              pgBrowser.Node.panels[d.id].$container) {
            p = pgBrowser.Node.panels[d.id];
            /**  TODO ::
             *  Run in edit mode (if asked) only when it is
             *  not already been running edit mode
             **/
            var mode = p.$container.attr('action-mode');
            if (mode) {
              var msg = '{{ _('Are you sure want to stop editing the properties of %s "%s"?') }}';
              if (args.action == 'edit') {
                msg = '{{ _('Are you sure want to reset the current changes and re-open the panel for %s "%s"?') }}';
              }

              Alertify.confirm(
                '{{ _('Edit in progress?') }}',
                S(msg).sprintf(o.label.toLowerCase(), d.label).value(),
                function() {
                  setTimeout(function() {
                    o.showProperties(i, d, p, args.action);
                  }, 10);
                },
                null).show();
            } else {
              setTimeout(function() {
                o.showProperties(i, d, p, args.action);
              }, 10);
            }
          } else {
            pgBrowser.Node.panels = pgBrowser.Node.panels || {};
            p = pgBrowser.Node.panels[d.id] = addPanel();

            setTimeout(function() {
              o.showProperties(i, d, p, args.action);
            }, 10);
          }
        }

        p.title(l);
        p.icon('icon-' + this.type);

        // Make sure the properties dialog is visible
        p.focus();
      },
      // Delete the selected object
      delete_obj: function(args, item) {
          var input = args || {'url':'drop'},
              obj = this,
              t = pgBrowser.tree,
              i = input.item || item || t.selected(),
              d = i && i.length == 1 ? t.itemData(i) : undefined;

        if (!d)
          return;

        /*
         * Make sure - we're using the correct version of node
         */
        obj = pgBrowser.Nodes[d._type];
        var objName = d.label;

        var msg, title;
        if (input.url == 'delete') {

          msg = S('{{ _('Are you sure you want to drop %s "%s" and all the objects that depend on it?') }}')
            .sprintf(obj.label.toLowerCase(), d.label).value();
          title = S('{{ _('DROP CASCADE %s?') }}').sprintf(obj.label).value();

          if (!(_.isFunction(obj.canDropCascade) ?
                obj.canDropCascade.apply(obj, [d, i]) : obj.canDropCascade)) {
            Alertify.notify(
                S('The %s "%s" can not be dropped!')
                .sprintf(obj.label, d.label).value(),
                'error',
                10
                );
            return;
          }
        } else {
          msg = S('{{ _('Are you sure you want to drop %s "%s"?') }}')
            .sprintf(obj.label.toLowerCase(), d.label).value();
          title = S('{{ _('DROP %s?') }}').sprintf(obj.label).value();

          if (!(_.isFunction(obj.canDrop) ?
                obj.canDrop.apply(obj, [d, i]) : obj.canDrop)) {
            Alertify.notify(
                S('The %s "%s" can not be dropped!')
                .sprintf(obj.label, d.label).value(),
                'error', 10
                );
            return;
          }
        }
        Alertify.confirm(title, msg,
          function() {
            $.ajax({
              url: obj.generate_url(i, input.url, d, true),
              type:'DELETE',
              success: function(res) {
                if (res.success == 0) {
                  pgBrowser.report_error(res.errormsg, res.info);
                } else {
                  var n = t.next(i);
                  if (!n || !n.length) {
                    n = t.prev(i);
                    if (!n || !n.length) {
                      n = t.parent(i);
                      t.setInode(n, true);
                    }
                  }
                  t.remove(i);
                  if (n.length) {
                    t.select(n);
                  }
                }
                return true;
              },
              error: function(jqx) {
                var msg = jqx.responseText;
                /* Error from the server */
                if (jqx.status == 417 || jqx.status == 410 || jqx.status == 500) {
                  try {
                    var data = $.parseJSON(jqx.responseText);
                    msg = data.errormsg;
                  } catch (e) {}
                }
                pgBrowser.report_error(
                    S('{{ _('Error dropping %s: "%s"') }}')
                      .sprintf(obj.label, objName)
                        .value(), msg);
              }
            });
          },
          null).show()
      },
      // Callback for creating script(s) & opening them in Query editor
      show_script: function(args, item) {
        var scriptType = args.script,
          obj = this,
          t = pgBrowser.tree,
          i = item || t.selected(),
          d = i && i.length == 1 ? t.itemData(i) : undefined;

        if (!d)
          return;

        /*
         * Make sure - we're using the correct version of node
         */
        obj = pgBrowser.Nodes[d._type];
        var objName = d.label;

        // URL for script type
        if(scriptType == 'insert') {
          sql_url = 'insert_sql';
        } else if(scriptType == 'update') {
          sql_url = 'update_sql';
        } else if(scriptType == 'delete') {
          sql_url = 'delete_sql';
        } else if(scriptType == 'select') {
          sql_url = 'select_sql';
        } else if(scriptType == 'exec') {
          sql_url = 'exec_sql';
        } else {
          // By Default get CREATE SQL
          sql_url = 'sql';
        }
        // Open data grid & pass the URL for fetching
        pgAdmin.DataGrid.show_query_tool.apply(
          this, [obj.generate_url(i, sql_url, d, true), i]
        );
      },

      // Callback to render query editor
      show_query_tool: function(args, item) {
        var obj = this,
          t = pgBrowser.tree,
          i = item || t.selected(),
          d = i && i.length == 1 ? t.itemData(i) : undefined;

        if (!d)
          return;

        // Here call data grid method to render query tool
        pgAdmin.DataGrid.show_query_tool.apply(
          this, [undefined, i]
        );
      },
      added: function(item, data, browser) {
        var b = browser || pgBrowser,
            t = b.tree,
            pItem = t.parent(item),
            pData = pItem && t.itemData(pItem),
            pNode = pData && pgBrowser.Nodes[pData._type];

        // Check node is a collection or not.
        if (pNode && pNode.is_collection) {
          /* If 'collection_count' is not present in data
           * it means tree node expanded first time, so we will
           * kept collection count and label in data itself.
           */
          if (!('collection_count' in pData)) {
            pData.collection_count = 0;
          }
          pData.collection_count++;
          t.setLabel(
            pItem, {
              label: (
                pData._label + ' <span>(' + pData.collection_count + ')</span>'
              )
            }
          );
        }
      },
      // Callback called - when a node is selected in browser tree.
      selected: function(item, data, browser) {
        // Show the information about the selected node in the below panels,
        // which are visible at this time:
        // + Properties
        // + Query (if applicable, otherwise empty)
        // + Dependents
        // + Dependencies
        // + Statistics
        var b = browser || pgBrowser,
            t = b.tree,
            d = data || t.itemData(item);

        // Update the menu items
        pgAdmin.Browser.enable_disable_menus.apply(b, [item]);

        if (d && b) {
          if ('properties' in b.panels &&
              b.panels['properties'] &&
              b.panels['properties'].panel &&
              b.panels['properties'].panel.isVisible()) {
            // Show object properties (only when the 'properties' tab
            // is active).
            this.showProperties(item, d, b.panels['properties'].panel);
          }
          if ('sql' in b.panels &&
              b.panels['sql'] &&
              b.panels['sql'].panel &&
              b.panels['sql'].panel.isVisible()) {
            // TODO:: Show reverse engineered query for this object (when 'sql'
            // tab is active.)
          }
          if ('statistics' in b.panels &&
              b.panels['statistics'] &&
              b.panels['statistics'].panel &&
              b.panels['statistics'].panel.isVisible()) {
            // TODO:: Show statistics for this object (when the 'statistics'
            // tab is active.)
          }
          if ('dependencies' in b.panels &&
              b.panels['dependencies'] &&
              b.panels['dependencies'].panel &&
              b.panels['dependencies'].panel.isVisible()) {
            // TODO:: Show dependencies for this object (when the
            // 'dependencies' tab is active.)
          }
          if ('dependents' in b.panels &&
              b.panels['dependents'] &&
              b.panels['dependents'].panel &&
              b.panels['dependents'].panel.isVisible()) {
            // TODO:: Show dependents for this object (when the 'dependents'
            // tab is active.)
          }
        }

        return true;
      },
      removed: function(item) {
        var self = this,
            t = pgBrowser.tree,
            pItem = t.parent(item),
            pData = pItem && t.itemData(pItem),
            pNode = pData && pgBrowser.Nodes[pData._type];

        // Check node is a collection or not.
        if (
          pNode && pNode.is_collection && 'collection_count' in pData
        ) {
          pData.collection_count--;
          t.setLabel(
            pItem, {
              label: (
                pData._label + ' <span>(' + pData.collection_count + ')</span>'
              )
            }
          );
        }

        setTimeout(function() { self.clear_cache.apply(self, item); }, 0);
      },
      unloaded: function(item) {
        var self = this,
            t = pgBrowser.tree,
            data = item && t.itemData(item);

        // In case of unload remove the collection counter
        if (self.is_collection && 'collection_count' in data)
        {
          delete data.collection_count;
          t.setLabel(item, {label: data._label});
        }
      },
      refresh: function(cmd, i) {
        var self = this,
            t = pgBrowser.tree,
            item = i || t.selected(),
            d = t.itemData(item);

        pgBrowser.Events.trigger('pgadmin:browser:tree:refresh', item);
      }
    },
    /**********************************************************************
     * A hook (not a callback) to show object properties in given HTML
     * element.
     *
     * This has been used for the showing, editing properties of the node.
     * This has also been used for creating a node.
     **/
    showProperties: function(item, data, panel, action) {
      var that = this,
        tree = pgAdmin.Browser.tree,
        j = panel.$container.find('.obj_properties').first(),
        view = j.data('obj-view'),
        content = $('<div tabindex="1"></div>')
          .addClass('pg-prop-content col-xs-12'),

        // Template function to create the status bar
        createStatusBar = function(location){
            var statusBar = $('<div></div>').addClass(
                      'pg-prop-status-bar'
                      ).appendTo(j);
            statusBar.css("visibility", "hidden");
            if (location == "header") {
                statusBar.appendTo(that.header);
            } else {
                statusBar.prependTo(that.footer);
            }
            that.statusBar = statusBar;
            return statusBar;
        }.bind(panel),
        // Template function to create the button-group
        createButtons = function(buttons, location, extraClasses) {
          var panel = this;

          // arguments must be non-zero length array of type
          // object, which contains following attributes:
          // label, type, extraClasses, register
          if (buttons && _.isArray(buttons) && buttons.length > 0) {
            // All buttons will be created within a single
            // div area.
            var btnGroup =
              $('<div></div>').addClass(
                  'pg-prop-btn-group'
                  ),
              // Template used for creating a button
              tmpl = _.template([
                '<button type="<%= type %>" ',
                'class="btn <%=extraClasses.join(\' \')%>"',
                '<% if (disabled) { %> disabled="disabled"<% } %> title="<%-tooltip%>">',
                '<span class="<%= icon %>"></span><% if (label != "") { %>&nbsp;<%-label%><% } %></button>'
                ].join(' '));
            if (location == "header"){
                btnGroup.appendTo(that.header);
            }else{
                btnGroup.appendTo(that.footer);
            }
            if (extraClasses) {
              btnGroup.addClass(extraClasses);
            }
            _.each(buttons, function(btn) {
              // Create the actual button, and append to
              // the group div

              // icon may not present for this button
              if (!btn.icon) {
                btn.icon = "";
              }
              var b = $(tmpl(btn));
              btnGroup.append(b);
              // Register is a callback to set callback
              // for certain operation for this button.
              btn.register(b);
            });
            return btnGroup;
          }
          return null;
        }.bind(panel),
        // Callback to show object properties
        properties = function() {

          // Avoid unnecessary reloads
          var panel = this,
              i = tree.selected(),
              d = i && tree.itemData(i),
              n_type = d._type,
              n_value = -1,
              n = i && d && pgBrowser.Nodes[d._type],
              treeHierarchy = n.getTreeNodeHierarchy(i);

          if (_.isEqual($(panel).data('node-prop'), treeHierarchy)) {
            return;
          }

          // Cache the current IDs for next time
          $(panel).data('node-prop', treeHierarchy);

          if (!content.hasClass('has-pg-prop-btn-group'))
            content.addClass('has-pg-prop-btn-group');

          // We need to release any existing view, before
          // creating new view.
          if (view) {
            // Release the view
            view.remove({data: true, internal: true, silent: true});
            // Deallocate the view
            delete view;
            view = null;
            // Reset the data object
            j.data('obj-view', null);
          }
          // Make sure the HTML element is empty.
          j.empty();
          that.header = $('<div></div>').addClass(
                      'pg-prop-header'
                      ).appendTo(j);
          that.footer = $('<div></div>').addClass(
                      'pg-prop-footer'
                      ).appendTo(j);
          // Create a view to show the properties in fieldsets
          view = that.getView(item, 'properties', content, data, 'fieldset', undefined, j);
          if (view) {
            // Save it for release it later
            j.data('obj-view', view);

            // Create status bar
            createStatusBar('footer');

            // Create proper buttons

            var buttons = [];

            buttons.push({
              label: '', type: 'edit',
              tooltip: '{{ _("Edit") }}',
              extraClasses: ['btn-default'],
              icon: 'fa fa-lg fa-pencil-square-o',
              disabled: !that.canEdit,
              register: function(btn) {
                btn.click(function() {
                  onEdit();
                });
              }
            });

            buttons.push({
              label: '', type: 'help',
              tooltip: '{{ _("SQL help for this object type.") }}',
              extraClasses: ['btn-default', 'pull-right'],
              icon: 'fa fa-lg fa-info',
              disabled: (that.sqlAlterHelp == '' && that.sqlCreateHelp == '') ? true : false,
              register: function(btn) {
                btn.click(function() {
                  onSqlHelp();
                });
              }
            });

            createButtons(buttons, 'header', 'pg-prop-btn-group-above');
          }
          j.append(content);
        }.bind(panel),
        onSqlHelp = function() {
          var panel = this;
          // See if we can find an existing panel, if not, create one
          pnlSqlHelp = pgBrowser.docker.findPanels('pnl_sql_help')[0];

          if (pnlSqlHelp == null) {
            pnlProperties = pgBrowser.docker.findPanels('properties')[0];
            pgBrowser.docker.addPanel('pnl_sql_help', wcDocker.DOCK.STACKED, pnlProperties);
            pnlSqlHelp = pgBrowser.docker.findPanels('pnl_sql_help')[0];
          }

          // Construct the URL
          server = that.getTreeNodeHierarchy(item).server;

          url = '{{ pg_help_path }}'
          if (server.server_type == 'ppas') {
            url = '{{ edbas_help_path }}'
          }

          major = Math.floor(server.version / 10000)
          minor = Math.floor(server.version / 100) - (major * 100)

          url = url.replace('$VERSION$', major + '.' + minor)
          if (!S(url).endsWith('/')) {
            url = url + '/'
          }
          if (that.sqlCreateHelp == '' && that.sqlAlterHelp != '') {
              url = url + that.sqlAlterHelp
          } else if (that.sqlCreateHelp != '' && that.sqlAlterHelp == '') {
              url = url + that.sqlCreateHelp
          } else {
            if (view.model.isNew()) {
              url = url + that.sqlCreateHelp
            } else {
              url = url + that.sqlAlterHelp
            }
          }

          // Update the panel
          iframe = $(pnlSqlHelp).data('embeddedFrame');
          pnlSqlHelp.title('SQL: ' + that.label);

          pnlSqlHelp.focus();
          iframe.openURL(url);
        }.bind(panel),

        onDialogHelp = function() {
          var panel = this;
          // See if we can find an existing panel, if not, create one
          pnlDialogHelp = pgBrowser.docker.findPanels('pnl_online_help')[0];

          if (pnlDialogHelp == null) {
            pnlProperties = pgBrowser.docker.findPanels('properties')[0];
            pgBrowser.docker.addPanel('pnl_online_help', wcDocker.DOCK.STACKED, pnlProperties);
            pnlDialogHelp = pgBrowser.docker.findPanels('pnl_online_help')[0];
          }

          // Update the panel
          iframe = $(pnlDialogHelp).data('embeddedFrame');

          pnlDialogHelp.focus();
          iframe.openURL(that.dialogHelp);
        }.bind(panel),

        editFunc = function() {
          var panel = this;
          if (action && action == 'properties') {
            action = 'edit';
          }
          panel.$container.attr('action-mode', action);
          // We need to release any existing view, before
          // creating the new view.
          if (view) {
            // Release the view
            view.remove({data: true, internal: true, silent: true});
            // Deallocate the view
            delete view;
            view = null;
            // Reset the data object
            j.data('obj-view', null);
          }
          // Make sure the HTML element is empty.
          j.empty();

          that.header = $('<div></div>').addClass(
                      'pg-prop-header'
                      ).appendTo(j)
          that.footer = $('<div></div>').addClass(
                      'pg-prop-footer'
                      ).appendTo(j);

          var updateButtons = function(hasError, modified) {

            var btnGroup = this.find('.pg-prop-btn-group'),
                btnSave = btnGroup.find('button.btn-primary'),
                btnReset = btnGroup.find('button.btn-warning');

            if (hasError || !modified) {
              btnSave.prop('disabled', true);
              btnSave.attr('disabled', 'disabled');
            } else {
              btnSave.prop('disabled', false);
              btnSave.removeAttr('disabled');
            }

            if (!modified) {
              btnReset.prop('disabled', true);
              btnReset.attr('disabled', 'disabled');
            } else {
              btnReset.prop('disabled', false);
              btnReset.removeAttr('disabled');
            }
          };

          // Create a view to edit/create the properties in fieldsets
          view = that.getView(item, action, content, data, 'dialog', updateButtons, j, onCancelFunc);
          if (view) {
            // Save it to release it later
            j.data('obj-view', view);

            panel.icon(
                _.isFunction(that['node_image']) ?
                  (that['node_image']).apply(that, [data, view.model]) :
                  (that['node_image'] || ('icon-' + that.type))
                );

            // Create proper buttons
            createButtons([{
              label: '', type: 'help',
              tooltip: '{{ _("SQL help for this object type.") }}',
              extraClasses: ['btn-default', 'pull-left'],
              icon: 'fa fa-lg fa-info',
              disabled: (that.sqlAlterHelp == '' && that.sqlCreateHelp == '') ? true : false,
              register: function(btn) {
                btn.click(function() {
                  onSqlHelp();
                });
              }
            },{
              label: '', type: 'help',
              tooltip: '{{ _("Help for this dialog.") }}',
              extraClasses: ['btn-default', 'pull-left'],
              icon: 'fa fa-lg fa-question',
              disabled: (that.dialogHelp == '') ? true : false,
              register: function(btn) {
                btn.click(function() {
                  onDialogHelp();
                });
              }
            },{
              label: '{{ _("Save") }}', type: 'save',
              tooltip: '{{ _("Save this object.") }}',
              extraClasses: ['btn-primary'],
              icon: 'fa fa-lg fa-save',
              disabled: true,
              register: function(btn) {
                // Save the changes
                btn.click(function() {
                  var m = view.model,
                    d = m.toJSON(true),

                    // Generate a timer for the request
                    timer = setTimeout(function(){
                      $('.obj_properties').addClass('show_progress');
                    }, 1000);

                  if (d && !_.isEmpty(d)) {
                    m.save({}, {
                      attrs: d,
                      validate: false,
                      cache: false,
                      success: function() {
                        onSaveFunc.call();
                        // Hide progress cursor
                        $('.obj_properties').removeClass('show_progress');
                        clearTimeout(timer);

                        // Removing the node-prop property of panel
                        // so that we show updated data on panel
                        var pnlProperties = pgBrowser.docker.findPanels('properties')[0],
                          pnlSql = pgBrowser.docker.findPanels('sql')[0],
                          pnlStats = pgBrowser.docker.findPanels('statistics')[0],
                          pnlDependencies = pgBrowser.docker.findPanels('dependencies')[0],
                          pnlDependents = pgBrowser.docker.findPanels('dependents')[0];

                        if(pnlProperties)
                            $(pnlProperties).removeData('node-prop');
                        if(pnlSql)
                            $(pnlSql).removeData('node-prop');
                        if(pnlStats)
                            $(pnlStats).removeData('node-prop');
                        if(pnlDependencies)
                            $(pnlDependencies).removeData('node-prop');
                        if(pnlDependents)
                            $(pnlDependents).removeData('node-prop');
                      },
                      error: function(m, jqxhr) {
                        Alertify.pgNotifier(
                          "error", jqxhr,
                          S(
                            "{{ _("Error saving properties: %s") }}"
                            ).sprintf(jqxhr.statusText).value()
                          );

                        // Hide progress cursor
                        $('.obj_properties').removeClass('show_progress');
                        clearTimeout(timer);
                      }
                    });
                  }
                });
              }
            },{
              label: '{{ _('Cancel') }}', type: 'cancel',
              tooltip: '{{ _("Cancel changes to this object.") }}',
              extraClasses: ['btn-danger'],
              icon: 'fa fa-lg fa-close',
              disabled: false,
              register: function(btn) {
                btn.click(function() {
                  // Removing the action-mode
                  panel.$container.removeAttr('action-mode');
                  onCancelFunc.call(arguments);
                });
              }
            },{
              label: '{{ _('Reset') }}', type: 'reset',
              tooltip: '{{ _("Reset the fields on this dialog.") }}',
              extraClasses: ['btn-warning'],
              icon: 'fa fa-lg fa-recycle',
              disabled: true,
              register: function(btn) {
                btn.click(function() {
                  setTimeout(function() { editFunc.call(); }, 0);
                });
              }
            }],'footer' ,'pg-prop-btn-group-below');
          };

          // Create status bar.
          createStatusBar('footer');

          // Add some space, so that - button group does not override the
          // space
          content.addClass('pg-prop-has-btn-group-below');

          // Show contents before buttons
          j.prepend(content);
        }.bind(panel),
        closePanel = function() {
          // Closing this panel
          this.close();
        }.bind(panel),
        updateTreeItem = function(that) {
          var _old = data,
              _new = _.clone(view.model.tnode),
              info = _.clone(view.model.node_info);

          // Clear the cache for this node now.
          setTimeout(function() { that.clear_cache.apply(that, item); }, 0);

          pgBrowser.Events.trigger(
            'pgadmin:browser:tree:update',
            _old, _new, info, {
              success: function() {
                pgBrowser.Events.trigger(
                  'pgadmin:browser:node:updated', _new
                );
              }
            }
          );
          closePanel();
        },
        saveNewNode = function(that) {
          var panel = this,
              j = panel.$container.find('.obj_properties').first(),
              view = j.data('obj-view');

          // Clear the cache for this node now.
          setTimeout(function() { that.clear_cache.apply(that, item); }, 0);
          try {
            pgBrowser.Events.trigger(
              'pgadmin:browser:tree:add', _.clone(view.model.tnode),
              _.clone(view.model.node_info)
            );
          } catch (e) {
            console.log(e);
          }
          closePanel();
        }.bind(panel, that),
        editInNewPanel = function() {
          // Open edit in separate panel
          setTimeout(function() {
            that.callbacks.show_obj_properties.apply(that, [{
              'action': 'edit',
              'item': item
            }]);
          }, 0);
        },
        onCancelFunc = closePanel,
        onSaveFunc = updateTreeItem.bind(panel, that),
        onEdit = editFunc.bind(panel);

      if (action) {
        if (action == 'create'){
          onCancelFunc = closePanel;
          onSaveFunc = saveNewNode;
        }
        if (action != 'properties') {
          // We need to keep track edit/create mode for this panel.
          editFunc();
        } else {
          properties();
        }
      } else {
        /* Show properties */
        properties();
        onEdit = editInNewPanel.bind(panel);
      }
      if (panel.closeable()) {
        var onCloseFunc = function() {
          var j = this.$container.find('.obj_properties').first(),
              view = j && j.data('obj-view');

          if (view) {
            view.remove({data: true, internal: true, silent: true});
          }
        }.bind(panel);
        panel.on(wcDocker.EVENT.CLOSED, onCloseFunc);
      }
    },
    _find_parent_node: function(t, i, d) {
      if (this.parent_type) {
        d = d || t.itemData(i);

        if (_.isString(this.parent_type)) {
          if (this.parent_type == d._type) {
            return i;
          }
          while(t.hasParent(i)) {
            i = t.parent(i);
            d = t.itemData(i);

            if (this.parent_type == d._type)
              return i;
          }
        } else {
          if (_.indexOf(this.parent_type, d._type) >= 0) {
            return i;
          }
          while(t.hasParent(i)) {
            i = t.parent(i);
            d = t.itemData(i);

            if (_.indexOf(this.parent_type, d._type) >= 0)
              return i;
          }
        }
      }
      return null;
    },
    /**********************************************************************
     * Generate the URL for different operations
     *
     * arguments:
     *   type:  Create/drop/edit/properties/sql/depends/statistics
     *   d:     Provide the ItemData for the current item node
     *   with_id: Required id information at the end?
     *
     * Supports url generation for create, drop, edit, properties, sql,
     * depends, statistics
     */
    generate_url: function(item, type, d, with_id, info) {
      var url = pgBrowser.URL + '{TYPE}/{REDIRECT}{REF}',
        opURL = {
          'create': 'obj', 'drop': 'obj', 'edit': 'obj',
          'properties': 'obj', 'statistics': 'stats'
        },
        ref = '', self = this,
        priority = -Infinity;

      info = (_.isUndefined(item) || _.isNull(item)) ?
        info || {} : this.getTreeNodeHierarchy(item);

      if (self.parent_type) {
        if (_.isString(self.parent_type)) {
          var p = info[self.parent_type];
          if (p) {
            priority = p.priority;
          }
        } else {
          _.each(self.parent_type, function(o) {
            var p = info[o];
            if (p) {
              if (priority < p.priority) {
                priority = p.priority;
              }
            }
          });
        }
      }

      _.each(
        _.sortBy(
          _.values(
           _.pick(info,
            function(v, k, o) {
              return (v.priority <= priority);
            })
           ),
          function(o) { return o.priority; }
          ),
        function(o) {
          ref = S('%s/%s').sprintf(ref, encodeURIComponent(o._id)).value();
        });

      ref = S('%s/%s').sprintf(
          ref, with_id && d._type == self.type ? encodeURIComponent(d._id) : ''
          ).value();

      var args = {
        'TYPE': self.type,
        'REDIRECT': (type in opURL ? opURL[type] : type),
        'REF': ref
      };

      return url.replace(/{(\w+)}/g, function(match, arg) {
        return args[arg];
      });
    },
    // Base class for Node Data Collection
    Collection: pgBrowser.DataCollection,
    // Base class for Node Data Model
    Model: pgBrowser.DataModel,
    getTreeNodeHierarchy: function(i) {
      var idx = 0,
          res = {},
          t = pgBrowser.tree;
      do {
        d = t.itemData(i);
        if (d._type in pgBrowser.Nodes && pgBrowser.Nodes[d._type].hasId) {
          res[d._type] = _.extend({}, d, {
            'priority': idx
          });
          idx -= 1;
        }
        i = t.hasParent(i) ? t.parent(i) : null;
      } while (i);

      return res;
    },
    cache: function(url, node_info, level, data) {
      var cached = this.cached = this.cached || {},
          hash = url,
          min_priority = (
              node_info && node_info[level] && node_info[level].priority
              ) || 0;

      if (node_info) {
        _.each(
            _.sortBy(
              _.values(
                _.pick(
                  node_info,
                  function(v, k, o) {
                    return (v.priority <= min_priority);
                  })),
              function(o) { return o.priority; }),
            function(o) {
              hash = S('%s/%s').sprintf(hash, encodeURI(o._id)).value();
            });
      }

      if (_.isUndefined(data)) {
        var res = cached[hash];

        if (!_.isUndefined(res) &&
            (res.at - Date.now() > 300000)) {
          res = undefined;
        }
        return res;
      }

      res = cached[hash] = {data: data, at: Date.now(), level: level};

      return res;
    },
    clear_cache: function(item) {
      /*
       * Reset the cache, when new node is created.
       *
       * FIXME:
       * At the moment, we will clear all the cache for this node. But - we
       * would like to clear the cache only this nodes parent, so that - it
       * fetches the new data.
       */
      this.cached = {};
    },
    cache_level: function(node_info, with_id) {
      if (node_info) {
        if (with_id && this.type in node_info) {
          return this.type;
        }
        if (_.isArray(this.parent_type)) {
          for (var parent in this.parent_type) {
            if (parent in node_info) {
              return parent;
            }
          }
          return this.type;
        }
        return this.parent_type;
      }
    }
  });

  return pgAdmin.Browser.Node;
});
