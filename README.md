# Bamboo Flute Customizer · 竹笛定制工具

Explore a bamboo flute in 3D, try a pattern or upload your own image, and
export the result. The interface is available in English and Chinese.

**[Open Dizi Studio →](https://qiuxue-yee.github.io/bamboo-flute-customizer/)**

![Dizi Studio with a bamboo-leaf pattern on the model](docs/workbench-preview.png)

## What you can do

- Rotate and zoom the 3D model, or switch to a close-up view.
- Choose from four patterns or upload a PNG, JPEG, or WebP image (up to 5 MB).
- Adjust the image position and undo or redo changes.
- Export the customized part as GLB or STL, or download a ZIP with all three parts.

Your image stays in the browser and is not uploaded. It is cleared when the page
is reloaded.

## Export and model notes

GLB keeps the model's appearance and uses metres. STL contains geometry only;
its numeric coordinates are in millimetres, so select millimetres when opening
it in other software. Physical assembly, printing, and tuning have not yet been
tested. See the [model report](docs/model-report.md) for details.

## 中文说明

在三维视图中查看竹笛，选择预设图案或上传自己的图片，调整位置后导出模型。
界面支持中英文；图片仅在浏览器中使用，刷新后不会保存。

GLB 保留模型外观，使用米；STL 仅包含几何形状，数值按毫米解释。实体装配、
打印效果和音准尚未实测。

## Run locally

Use Node.js 22.12+ on the 22.x release line, Node.js 24, or Node.js 26+:

```sh
npm ci
npm start
```

Open <http://127.0.0.1:9999>. For development and model checks, see
[Developer notes](docs/development.md).

## License

[MIT](LICENSE)
