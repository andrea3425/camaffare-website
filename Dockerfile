FROM nginx:alpine

COPY index.html /usr/share/nginx/html/index.html
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/
COPY public/ /usr/share/nginx/html/public/
COPY gallery/ /usr/share/nginx/html/gallery/

EXPOSE 80
