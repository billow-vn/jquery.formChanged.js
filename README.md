```HTML
<script src="jquery.formChanged.js"></script>
<script type="text/javascript">
    var $forms       = $('.content-wrapper .data-table form'), // form's selector
        formsChanged = new FormChanged({
            selector: $forms,
        });

    formsChanged.update();
</script>
```
