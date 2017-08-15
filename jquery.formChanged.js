(function (__, $) {
    function FormChanged(opts) {
        var self        = this,
            statusForms = [],
            seqId       = 0,
            $body       = $('body'),
            $window     = $(window)
        ;

        opts = fnInitOptsDefault(opts);

        $.extend(self, opts.settings, self);

        $.extend(true, self, {
            isSubmitting:       0,
            isCalling:          0,
            isRedirecting:      0,
            isHashDirty:        0,
            isNavCalling:       0,
            isSkippedHashDirty: 0,
            hrefCurrent:        window.location.href,
            hrefInHistory:      window.location.href,
            $targeting:         undefined,
            $dialogs:           {},
            $dialogOverlays:    {},
            $ignoreForms:       {},
            $callers:           $(opts.callers),
            $forms:             $(opts.selector)
        });

        fnInitHash();

        // ignore elements in form
        if (opts.ignoreForms) {
            var $ignoreForms = $(opts.ignoreForms);
            if ($ignoreForms.length) {
                var $ignoreElements = $ignoreForms.find('input, select, textarea, [contenteditable], [data-fc-href], .fc-is-back');
                self.$ignoreForms   = $ignoreForms;
                self.$forms         = self.$forms.not($ignoreForms);
                self.$callers       = self.$callers.not($ignoreElements);
            }
        }

        fnInitDialog(opts.dialog);

        // Creating event listen
        fnInitEventListener();

        return $.extend(self, {
            'initHash':         fnInitHash,
            'initDialog':       fnInitDialog,
            'fetchDialog':      fnFetchDialog,
            'isDirty':          fnIsDirty,
            'reset':            fnReset,
            'check':            fnCheckAll,
            'update':           fnUpdateStatus,
            'updateElement':    fnUpdateElementStatusInForm,
            'makeCID':          fnMakeFormCID,
            'takeCID':          fnTakeFormCID,
            'setHrefWithDirty': fnSetHrefWithDirty,
            'setHrefInHistory': fnRevertHrefInHistory
        });

        function fnInitHash() {
            if (!$.isEmptyObject(self.hash) && !$.isEmptyObject(self.hash.targets)) {
                self.hash.isInited = {};

                var hashNameEvents = [];
                $.each(self.hash.targets, function (key/*, $form*/) {
                    hashNameEvents.push(key);
                    self.hash.isInited[key] = 0;
                });

                self.hashEvents = hashNameEvents.join('|');
            }

            if (self.hashEvents && $.trim(self.hashEvents).length) {
                $window.bind('hashchange', function () {
                    var href = window.location.href;
                    if (href !== self.hrefCurrent) {
                        var resFindTarget = new RegExp('#(' + self.hashEvents + ')\\s*$').exec(self.hrefCurrent);
                        if (!self.isSkippedHashDirty && resFindTarget && $.isArray(resFindTarget) && resFindTarget.length) {
                            self.hrefInHistory = href;
                            var targetName     = resFindTarget[1],
                                $target        = self.hash.targets[targetName];

                            if (self.hash.isInited[targetName]
                                && $target instanceof jQuery
                                && $target.length
                            ) {
                                console.log('Begin check & hide form!', targetName);
                                self.isNavCalling = 1;
                                $target.trigger('fce:check', dialogOpts);
                                return; //jmp out
                            }
                        }

                        if (self.isSkippedHashDirty > 0) {
                            self.isSkippedHashDirty--;
                        }

                        self.hrefInHistory = self.hrefCurrent = href;
                    }
                });
            }
        }

        function fnInitOptsDefault(opts) {
            var defaultOpts = {
                selector:       'form',
                ignoreElements: ':hidden',
                ignoreForms:    undefined,
                callers:        null,
                focus:          0,
                classes:        {
                    form_change:   'fc-change-confirm',
                    form_always:   'fc-always-confirm',
                    form_inputted: 'fc-inputted',
                    form_dirty:    'fc-form-dirty',
                    element_dirty: 'fc-elem-dirty'
                },
                settings:       {
                    hash:             {
                        maps:     0,
                        targets:  {},
                        isInited: {}
                    },
                    fnBindConfirm:    function (e, fnCallbackIsDirty, dialogOpts) {
                        if (!e.isDefaultPrevented()
                            && !e.isPropagationStopped()
                            && !e.isImmediatePropagationStopped()) {

                            var eventType   = e.type.toLowerCase(),
                                statusDirty = 0;

                            if (!self.isCalling && !self.isSubmitting) {
                                self.$targeting = $(e.target);

                                switch (eventType) {
                                    case 'beforeunload':
                                        var isSkipped = self.$targeting.data('fcSkipped');
                                        if (self.isRedirecting > 0 || $body.hasClass('fc-redirecting') || isSkipped) {
                                            fnReset();
                                            return; // jmp out
                                        }
                                        break;
                                }

                                if (fnCallbackIsDirty === undefined) {
                                    fnCallbackIsDirty = self.isDirty();
                                }

                                if (typeof fnCallbackIsDirty === 'function') {
                                    statusDirty = fnCallbackIsDirty();
                                } else {
                                    statusDirty = !!fnCallbackIsDirty;
                                }

                                if (self.$targeting.length) {
                                    self.$targeting.trigger('fce:dirty', [statusDirty]);
                                }

                                if (statusDirty) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    e.stopImmediatePropagation();

                                    var msgReturn   = false;
                                    var _dialogOpts = 0;
                                    if (self.$targeting.length === 1) {
                                        _dialogOpts = self.$targeting.data('fcDialog');
                                    }

                                    if (_dialogOpts) {
                                        dialogOpts = _dialogOpts;
                                    }

                                    switch (eventType) {
                                        case 'beforeunload':
                                            // skip beforeunload
                                            fnReset();
                                            dialogOpts = fnMakeDialogOpts(dialogOpts);
                                            msgReturn  = (dialogOpts.title || '').replace(/<br\s*\/?>/i, '\n');
                                            break;
                                        default:
                                            var $dialog        = fnFetchDialog(dialogOpts);
                                            $dialog.$targeting = self.$targeting;
                                            $dialog.trigger('fce:dialog-show');
                                    }

                                    (e || window.event).returnValue = msgReturn;     //Gecko + IE
                                    return msgReturn;
                                }
                            }
                        }

                        switch (eventType) {
                            case 'beforeunload':
                                // skip beforeunload
                                fnReset();
                                break;
                            default:
                                if (!self.isCalling && !self.isSubmitting) {
                                    fnCallbackSafe(e, self.$targeting, [statusDirty]);
                                }
                        }

                        // reset status clicked  submit
                        self.isSubmitting = 0;
                    },
                    fnBindSubmit:     function () {
                        self.isSubmitting = 1;
                    },
                    fnBindReset:      function (e) {
                        var $form = $(e.target);
                        fnUpdateStatus($form);
                    },
                    fnOnFormDirty:    function () {
                    },
                    fnOnElementDirty: function () {
                    }
                },
                dialog:         {
                    id:      'dialog-fc-model-general',
                    title:   'このページから移動しますか？<br/>入力したデータは保存されません。',
                    buttons: {
                        No:  {
                            id:    'fc-d-no',
                            text:  'キャンセル',
                            click: function (e) {
                            }
                        },
                        Yes: {
                            id:    'fc-d-yes',
                            text:  '移動する',
                            click: function (e) {
                                var $dialog = this,
                                    $target = $dialog.$targeting;

                                fnCallbackSafe(e, $target, [0], 1);
                            }
                        }
                    }
                }
            };

            opts = $.extend(true, defaultOpts, opts);

            if (typeof opts.classes === 'object') {
                $.each(opts.classes, function (_key, _class) {
                    if (_class) {
                        if (typeof _class !== 'function') {
                            _class = $.trim('' + _class);
                            if (_class.length) {
                                opts.classes[_key] = _class;
                            } else {
                                opts.classes[_key] = 0;
                            }
                        }
                    } else {
                        opts.classes[_key] = 0;
                    }
                });
            }

            return opts;
        }

        function fnCallbackSafe(e, $target, values, sure) {
            if ($target instanceof jQuery && $target.length) {
                if (!sure) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }
                self.isCalling = 1;
                $target.trigger('fce:callback', $.makeArray(values));
                if (!sure) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }

                self.isCalling = 0;
            }
        }

        function fnFindByNameInForm($form, name) {
            return $form.find('[name="' + fnEscapeCssMeta(name) + '"]');
        }

        function fnEscapeCssMeta(string) {
            return string.replace(/([\\!"#$%&'()*+,./:;<=>?@\[\]^`{|}~])/g, '\\$1');
        }

        function fnCompareValue(first, second) {
            switch ($.type(first)) {
                case 'object':
                case 'array':
                    if (!second) {
                        return false;
                    }

                    // compare lengths - can save a lot of time
                    if (first.length !== second.length) {
                        return false;
                    }

                    for (var i = 0, l = first.length;
                         i < l;
                         i++) {
                        // Check if we have nested arrays
                        if (first[i] instanceof Array && second[i] instanceof Array) {
                            // recurse into the nested arrays
                            if (!first[i].equals(second[i])) {
                                return false;
                            }
                        }
                        else if (first[i] != second[i]) {
                            // Warning - two different object instances will never be equal: {x:20} != {x:20}
                            return false;
                        }
                    }
                    return true;
                    break;

                case  'string':
                default:
                    return first == second;

            }
        }

        function fnElementValueInForm($form, element) {
            var $element = $(element),
                type     = element.type,
                val, idx;

            if (type === 'radio' || type === 'checkbox') {
                return fnFindByNameInForm($form, element.name).filter(':checked').val();
            } else if (type === 'number' && typeof element.validity !== 'undefined') {
                return element.validity.badInput ? 'NaN' : $element.val();
            }

            if (element.hasAttribute('contenteditable')) {
                val = $element.text();
            } else {
                val = $element.val();
            }

            if (type === 'file') {

                // Modern browser (chrome & safari)
                if (val.substr(0, 12) === 'C:\\fakepath\\') {
                    return val.substr(12);
                }

                // Legacy browsers
                // Unix-based path
                idx = val.lastIndexOf('/');
                if (idx >= 0) {
                    return val.substr(idx + 1);
                }

                // Windows-based path
                idx = val.lastIndexOf('\\');
                if (idx >= 0) {
                    return val.substr(idx + 1);
                }

                // Just the file name
                return val;
            }

            if (typeof val === 'string') {
                return val.replace(/\r/g, '');
            }

            return val;
        }

        function fnInitEventListener() {
            $(document).ready(function () {
                var $submits = self.$forms.find(':submit:not(.fc-is-back)');

                $submits.bind('click', opts.settings.fnBindSubmit);
                self.$forms.filter(
                    fnConvertToClass(opts.classes.form_change)
                ).each(function () {
                    var $form     = $(this),
                        $elements = fnGetElementsInForm($form)
                            .not('.inited-event-focus');

                    $elements.addClass('inited-event-focus')
                        .on('change, keyup', function () {
                            $form.addClass(opts.classes.form_inputted);
                        });
                });

                self.$forms
                    .bind('reset', opts.settings.fnBindReset)
                    .bind('fce:check', function (e, optDialog) {
                        var $form = $(e.target);
                        opts.settings.fnBindConfirm(e, function () {
                            return fnCheckFormWrapper.call($form);
                        }, optDialog);
                    });

                $body.bind('fce:check', function (e, optDialog) {
                    fnCheckAll(e, optDialog);
                });

                if (self.$callers instanceof jQuery && self.$callers.length) {
                    self.$callers
                        .on('click', opts.settings.fnBindConfirm)
                        .on('fce:callback', function (/*e*/) {
                            var $this   = $(this),
                                tagName = $this.prop('tagName').toLowerCase();

                            switch (tagName) {
                                case 'input':
                                    var type = ($this.prop('type') || '').toLowerCase();
                                    switch (type) {
                                        case 'reset':
                                            var $form = $this.closest('form');
                                            if ($form.length) {
                                                $form[0].reset(); // call form reset
                                            }
                                            break;
                                        default:
                                            $this.trigger('click'); // sure is clicked
                                    }

                                    break;
                                default:
                                    $this.trigger('click'); // sure is clicked
                            }
                        });
                }
            });

            $window
                .bind('beforeunload', opts.settings.fnBindConfirm)
                .bind('resize', fnCenteringModelSyncer)
                .bind('unload onabort onload', fnReset)
            ;
        }

        function fnCenteringModelSyncer() {
            var w = $window.width();
            var h = $window.height();

            $.each(self.$dialogs, function (idx, $dialog) {
                var cw = $dialog.outerWidth(true);
                var ch = $dialog.outerHeight(true);
                $dialog.css({'left': ((w - cw) / 2) + 'px', 'top': ((h - ch) / 2) + 'px'});
            });
        }

        function fnMakeFormCID() {
            var d = new Date(),
                n = d.getTime();

            return 'form_cid_' + n + '_' + (++seqId);
        }

        function fnFormCIDIsValid(formCID) {
            return typeof formCID === 'string' && formCID.length;
        }

        function fnMakeFiltersCID(filterSelectors, result) {
            result = $.extend(true, {}, result);

            if (filterSelectors !== undefined) {
                var $filterSelectors = $(filterSelectors);
                $filterSelectors.each(function () {
                    var $form    = $(this),
                        _formCID = fnTakeFormCID($form);

                    if (typeof _formCID === 'string' && _formCID.length) {
                        result[_formCID] = 1;
                    }
                });
            }

            return result;
        }

        function fnTakeFormCID($form, autoSetNew) {
            $form = $($form);
            if ($form instanceof jQuery && $form.length) {
                var formCID = $.trim('' + ($form.data('formChangedId') || ''));

                if (autoSetNew && !fnFormCIDIsValid(formCID)) {
                    formCID = fnMakeFormCID();
                    $form.data('formChangedId', formCID);
                    $form.bind('fce:updateElement', fnUpdateElementStatus);
                }

                return formCID;
            }
        }

        function fnGetElementsInForm(form) {
            var $form = $(form);
            return $form
                .find('input, select, textarea, [contenteditable]')
                .filter(':text, select, textarea, [contenteditable], [type="password"], [type="file"], [type="number"], [type="search"], ' +
                        '[type="tel"], [type="url"], [type="email"], [type="datetime"], [type="date"], [type="month"], ' +
                        '[type="week"], [type="time"], [type="datetime-local"], [type="range"], [type="color"], ' +
                        '[type="radio"], [type="checkbox"], [type="button"]')
                .not(':submit, :reset, :image, :disabled');
        }

        function fnGetElementName() {
            var $elem = $(this);
            return $.trim('' + ($elem.attr('name') || ''));
        }

        function fnDataElementOrigin(formCID, elem, value) {
            var $elem    = $(elem),
                elemName = fnGetElementName.call($elem);

            if (elemName.length) {
                if (value !== undefined) {
                    statusForms[formCID][elemName] = value;
                }

                return statusForms[formCID][elemName];
            }
        }

        function fnReset(isResetAll) {
            self.isCalling     = 0;
            self.isSubmitting  = 0;
            self.isRedirecting = 0;
            self.$targeting    = undefined;
            $body.removeClass('fc-redirecting');
            var $_elements = fnGetElementsInForm(self.$forms);

            if (isResetAll) {
                if (isResetAll instanceof jQuery) {
                    isResetAll
                        .filter(
                            fnConvertToClass(opts.classes.form_change)
                        )
                        .filter(
                            fnConvertToClass(opts.classes.form_inputted)
                        )
                        .removeClass(opts.classes.form_inputted);
                } else {
                    self.$forms
                        .filter(
                            fnConvertToClass(opts.classes.form_change)
                        )
                        .filter(
                            fnConvertToClass(opts.classes.form_inputted)
                        )
                        .removeClass(opts.classes.form_inputted);
                }
            }

            self.$forms
                .filter(
                    fnConvertToClass(opts.classes.form_dirty)
                )
                .removeClass(opts.classes.form_dirty);

            $_elements
                .filter(
                    fnConvertToClass(opts.classes.element_dirty)
                )
                .removeClass(opts.classes.element_dirty);
        }

        function fnUpdateStatus(filterSelectors) {
            var filtersCID = fnMakeFiltersCID(filterSelectors);

            fnReset();

            self.$forms.each(function () {
                var $form   = $(this),
                    formCID = fnTakeFormCID($form, 1); // Founding Form Changed ID


                if (!fnFormCIDIsValid(formCID)) { // Not found formChangedID
                    return; // continue
                }

                statusForms[formCID] = $.makeArray(statusForms[formCID]);

                if (fnFormIsCheckable({
                        $form:      $form,
                        formCID:    formCID,
                        filtersCID: filtersCID
                    }, filterSelectors)) {
                    $form.removeClass(opts.classes.form_inputted);

                    var $elements = fnGetElementsInForm($form)
                        .not(opts.ignoreElements);

                    $elements.each(function () {
                        var element = this,
                            $elem   = $(element);

                        fnDataElementOrigin(formCID, $elem, fnElementValueInForm($form, element));
                    });
                }
            });
        }

        function fnUpdateElementStatus(element, value) {
            var $form   = $(this),
                formCID = fnTakeFormCID($form);

            return fnDataElementOrigin(formCID, element, value);
        }

        function fnUpdateElementStatusInForm(form, element, value) {
            return fnUpdateElementStatus.call(form, element, value);
        }

        function fnFormIsCheckable(opts, isCheckingInFilters) {
            opts = $.extend(true, {
                filtersCID: [],
                $form:      undefined,
                formCID:    undefined
            }, opts);

            var isPassed = 1;

            if (isCheckingInFilters !== undefined && opts.formCID !== undefined) {
                if (opts.filtersCID[opts.formCID]) {
                    isPassed = 2;
                } else {
                    isPassed = 0;
                }
            }

            if (isPassed === 1) {
                if (opts.$form instanceof jQuery) {
                    var isVisible = 1;
                    if (typeof opts.$form[0].isVisible === 'function') {
                        isVisible = opts.$form[0].isVisible();
                    }
                    return opts.$form.is(':visible') && isVisible;
                }
            }

            return isPassed;
        }

        function fnFormDirty(form, formDirty) {
            var $form = $(form);
            if (opts.classes.form_dirty) {
                $form.toggleClass(opts.classes.form_dirty, formDirty);
            }
            if (typeof opts.settings.fnOnFormDirty === 'function') {
                opts.settings.fnOnFormDirty.call(opts, $form, formDirty);
            }
        }

        function fnElementDirty($form, elem, elemDirty) {
            var $elem = $(elem);

            if (opts.classes.element_dirty) {
                $elem.toggleClass(opts.classes.element_dirty, elemDirty);
            }

            if (elemDirty && opts.focus) {
                $elem.focus();
            }

            if (typeof opts.settings.fnOnElementDirty === 'function') {
                opts.settings.fnOnElementDirty.call(opts, $form, $elem, elemDirty);
            }
        }

        function fnCheckAll(e, optDialog) {
            opts.settings.fnBindConfirm(e, undefined, optDialog);
        }

        function fnCheckFormWrapper(filterSelectors) {
            var filtersCID = fnMakeFiltersCID(filterSelectors);
            return fnCheckForm.call(this, filterSelectors, filtersCID);
        }

        function fnCheckForm(filterSelectors, filtersCID) {
            var $form     = $(this),
                formDirty = false,
                formCID   = fnTakeFormCID($form); // Founding Form Changed ID

            if (!fnFormCIDIsValid(formCID)) { // Not found formChangedID
                return; // continue
            }

            if ($form.hasClass(opts.classes.form_always) || $form.hasClass(opts.classes.form_inputted)) {
                return true;  // jump out
            }

            if (fnFormIsCheckable({
                    $form:      $form,
                    formCID:    formCID,
                    filtersCID: filtersCID
                }, filterSelectors)) {
                var $elements = fnGetElementsInForm($form)
                    .not(opts.ignoreElements);

                $elements.each(function () {
                    var elem      = this,
                        elemDirty = 0,
                        $elem     = $(elem),
                        elemName  = fnGetElementName.call($elem);

                    if (elemName.length &&
                        statusForms[formCID] &&
                        !fnCompareValue(statusForms[formCID][elemName], fnElementValueInForm($form, elem))
                    ) {
                        formDirty = 1;
                        elemDirty = 1;
                        if (!opts.classes.element_dirty) {
                            return false; // jump out
                        }
                    }

                    fnElementDirty($form, $elem, elemDirty);
                });
            }

            if (!!opts.classes.form_dirty) {
                fnFormDirty($form, formDirty);
            }

            return formDirty;
        }

        function fnIsDirty(filterSelectors) {
            var isDirty    = false,
                filtersCID = fnMakeFiltersCID(filterSelectors);

            self.$forms.each(function () {
                isDirty = isDirty || fnCheckForm.call(this, filterSelectors, filtersCID);
            });

            return isDirty;
        }

        function fnMakeDialog(dialogOpts) {
            var $dialog = self.$dialogs[dialogOpts.id];
            if (!($dialog instanceof jQuery && $dialog.length)) {
                $dialog = $('<div id="' + dialogOpts.id + '" class="dialog-fc-model">' +
                            '  <form class="alertedit">' +
                            '      <p>' + dialogOpts.title + '</p>' +
                            '      <ul>' +
                            '          <li>' +
                            '              <input type="button" id="' + dialogOpts.buttons.Yes.id + '" value="' + dialogOpts.buttons.Yes.text + '" class="btn_gr dialog-fc-ok">' +
                            '          </li>' +
                            '          <li>' +
                            '              <input type="button" id="' + dialogOpts.buttons.No.id + '" value="' + dialogOpts.buttons.No.text + '" class="btn_white dialog-fc-cancle"' +
                            '          </li>' +
                            '      </ul>' +
                            '  </form>' +
                            '</div>');

                var $btnCancle = $dialog.find('.dialog-fc-cancle'),
                    $btnOk     = $dialog.find('.dialog-fc-ok');

                $btnCancle.bind('click', function (e) {
                    typeof dialogOpts.buttons.No.click === 'function' && dialogOpts.buttons.No.click.call($dialog, e);
                    if (!e.isDefaultPrevented()
                        && !e.isPropagationStopped()
                        && !e.isImmediatePropagationStopped()
                    ) {
                        $dialog.trigger('fce:dialog-hide');
                    }
                });

                $btnOk.bind('click', function (e) {
                    typeof dialogOpts.buttons.Yes.click === 'function' && dialogOpts.buttons.Yes.click.call($dialog, e);
                    if (!e.isDefaultPrevented()
                        && !e.isPropagationStopped()
                        && !e.isImmediatePropagationStopped()
                    ) {
                        $dialog.trigger('fce:dialog-hide');
                    }
                });

                var $dialogOverlay = $('<div id="dialog-fc-overlay"></div>');
                $dialogOverlay.bind('click', function (e) {
                    if (!e.isDefaultPrevented()) {
                        $dialog.trigger('fce:dialog-hide');
                    }
                });

                $dialog.bind('fce:dialog-show', function (e) {
                    if (!e.isDefaultPrevented()) {
                        $dialogOverlay.fadeIn('fast');
                        $dialog.fadeIn('fast');
                        fnCenteringModelSyncer();
                        $btnOk.prop('disabled', false);
                        $btnCancle.prop('disabled', false);
                    }
                });

                $dialog.bind('fce:dialog-hide', function (e) {
                    if (!e.isDefaultPrevented()) {
                        $dialog.hide();
                        $dialogOverlay.hide();
                    }
                });

                $dialogOverlay.appendTo($body);
                $dialog.appendTo($body);

                self.$dialogs[dialogOpts.id]        = $dialog;
                self.$dialogOverlays[dialogOpts.id] = $dialogOverlay;
            }

            return $dialog;
        }

        function fnMakeDialogOpts(dialogOpts) {
            if (typeof dialogOpts !== 'object') {
                var dialogId = (dialogOpts || '');

                switch ($.type(dialogId)) {
                    case 'string':
                    case 'number':
                    case 'date':
                    case 'boolean':
                        // todo: something
                        break;
                    case 'function':
                        dialogId = dialogOpts();
                        break;
                    case 'object':
                    case 'array':
                        dialogId = dialogOpts;
                        break;
                }

                dialogId = $.trim('' + (dialogId || ''));
                if (dialogId.length) {
                    dialogOpts = {
                        id: dialogId
                    };
                } else {
                    dialogOpts = {
                        id: opts.dialog.id
                    };
                }
            }

            return $.extend(true, {}, opts.dialog, dialogOpts);
        }

        function fnFetchDialog(dialogOpts) {
            dialogOpts = fnMakeDialogOpts(dialogOpts);

            return fnMakeDialog(dialogOpts);
        }

        function fnInitDialog(dialogOpts) {
            dialogOpts = fnMakeDialogOpts(dialogOpts);
            fnMakeDialog(dialogOpts);

            return dialogOpts;
        }

        function fnConvertToClass(className) {
            return $.trim(className || '')
                .replace(/^([\w\d\-_])/, '.$1')
                .replace(/\s+([\w\d\-_])/, ', .$1');
        }

        function fnSetHrefWithDirty(e, isDirty) {
            if (!self.isSkippedHashDirty && self.isNavCalling) {
                if (isDirty && self.hrefCurrent !== self.hrefInHistory) {
                    self.isHashDirty = 1;

                    // Redirect to hrefCurrent
                    window.location.href = self.hrefCurrent;
                } else {
                    // clear statuses
                    self.isNavCalling = 0;
                    self.isHashDirty  = 0;
                }
            }
        }

        function fnRevertHrefInHistory() {
            if (!self.isSkippedHashDirty && self.isHashDirty && self.hrefCurrent !== self.hrefInHistory) {
                if (!/#/.test(self.hrefInHistory)) {
                    // avoid to reload page
                    self.hrefInHistory = self.hrefInHistory + '#';
                }

                // Redirect to hrefInHistory
                // and set hrefCurrent to avoid conflict
                window.location.href = self.hrefCurrent = self.hrefInHistory;

                // clear statuses
                self.isNavCalling = 0;
                self.isHashDirty  = 0;
            }
        }
    }

    __.FormChanged = FormChanged;

    $(document).ready(function () {
        $('[data-fc-href]').on('click', function () {
            var $this   = $(this),
                href    = $.trim('' + ($this.data('fcHref') || '')),
                tagName = $this.prop('tagName').toLowerCase();

            if (href.length) {
                tagName = 'a+';
            }

            switch (tagName) {
                case 'a':
                    href = $.trim($this.prop('href') || '');
                case 'a+':
                    if (href.length) {
                        window.location.href = href;
                    }
                    break;
            }
        });

        $('[data-fc-skipped]').bind('click', function () {
            $body.addClass('fc-redirecting');
        });
    });
})(this, jQuery);
