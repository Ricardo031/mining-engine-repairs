# **Prueba técnica – Desarrollador Full-Stack**

## **Desarrollo de una plataforma de gestión de reparaciones** **de motores de minería pesada**

### **1. Objetivo de la prueba**

Evaluar las competencias técnicas de un ingeniero de sistemas o profesional de carreras
afines, con aproximadamente dos años de experiencia en desarrollo de software, mediante la
construcción de una aplicación web que permita gestionar el proceso de reparación de
motores utilizados en maquinaria de minería pesada.


La solución deberá implementar una arquitectura basada en microservicios, separando la
gestión de usuarios y autenticación de la lógica central del negocio. Adicionalmente, deberá
contar con una interfaz web funcional, control de versiones mediante Git y un flujo de
integración y despliegue continuo (CI/CD) utilizando GitHub Actions.


Se evaluarán las habilidades de desarrollo backend y frontend, diseño de API REST,
seguridad, integración entre servicios, modelado de datos, buenas prácticas de programación
y capacidad para documentar y desplegar una solución.

### **2. Contexto del negocio**


Un taller especializado en la reparación de motores de maquinaria de minería pesada necesita
una aplicación interna para registrar y hacer seguimiento a los motores que ingresan a sus
instalaciones para diagnóstico, mantenimiento y reparación.


Actualmente, se requiere centralizar la información de los motores, los clientes, las órdenes
de reparación y los estados de cada servicio, de manera que el personal autorizado pueda
consultar el historial y conocer el avance de los trabajos.


La aplicación deberá permitir a los usuarios autenticados registrar motores, crear órdenes de
reparación, actualizar su información, consultar su estado y realizar el seguimiento de cada
servicio.


La solución deberá construirse como una aplicación distribuida en dos API independientes y
un frontend web.


### **3. Arquitectura requerida**

La solución deberá estar compuesta por los siguientes componentes:


**Servicio 1. API de autenticación y usuarios – Express + TypeScript**


Será responsable de administrar la identidad de los usuarios y controlar el acceso a la
plataforma.


Responsabilidades principales:


  - Registro y administración de usuarios.

  - Inicio de sesión mediante credenciales.

  - Validación de credenciales y almacenamiento seguro de contraseñas.

  - Generación de tokens JWT después de una autenticación exitosa.

  - Consulta, actualización y desactivación de usuarios.

  - Implementación de roles básicos de acceso.

  - Exposición de endpoints REST para las operaciones de autenticación y
administración de usuarios.


**Servicio 2. API de negocio – FastAPI + Python**


Será responsable de gestionar las operaciones relacionadas con los motores y sus
reparaciones.


Responsabilidades principales:


  - Registrar y administrar clientes.

  - Registrar y administrar motores.

  - Crear órdenes de reparación.

  - Consultar el historial de las órdenes.

  - Validar los tokens JWT emitidos por el servicio de autenticación antes de permitir el
acceso a los endpoints protegidos.


Este servicio deberá operar de manera independiente del servicio de autenticación. No deberá
almacenar contraseñas ni implementar un mecanismo de inicio de sesión propio.


**Frontend. Aplicación web – React + TypeScript**


Será la interfaz de interacción de los usuarios con la plataforma.


Responsabilidades principales:


  - Mostrar una pantalla de inicio de sesión.

  - Gestionar la sesión del usuario autenticado.

  - Consultar la información de los servicios backend.

  - Mostrar un tablero con las órdenes de reparación.

  - Permitir el registro de clientes, motores y órdenes, no se requiere flujo de
modificación.

  - Facilitar la consulta de un registro de reparación.

  - Presentar mensajes de confirmación y errores de manera clara.

### **4. Requerimientos funcionales**


**4.1. Autenticación y administración de usuarios**


Implementar en Express los siguientes procesos:


1. Registro de usuarios.
2. Inicio de sesión con correo electrónico y contraseña.
3. Generación de un JWT firmado que incluya, como mínimo, la identificación del

usuario y su información de autorización.
4. Validación de credenciales y manejo de errores de autenticación.
5. Consulta y actualización de usuarios.
6. Administración básica de roles, como administrador y usuario operativo.
7. Protección de los endpoints que requieran autenticación.


Las contraseñas deberán almacenarse utilizando un algoritmo seguro de hash. El token deberá
tener una expiración definida y su firma deberá verificarse mediante una configuración
segura.


**4.2. Gestión de clientes y motores**


Implementar en FastAPI las operaciones CRUD para clientes y motores.


**Cliente:**


  - Identificador único.

  - Nombre o razón social.

  - Tipo y número de identificación.

  - Correo electrónico.

  - Estado activo o inactivo.


**Motor:**


  - Identificador único.

  - Código interno o número de serie.

  - Fabricante (Campo abierto tipo texto).

  - Modelo (Campo abierto tipo texto)..

  - Tipo de motor (Campo abierto tipo texto)..

  - Potencia o capacidad (Campo abierto tipo texto).

  - Cliente propietario.

  - Fecha de registro.

  - Estado activo o inactivo.


Se deberán implementar validaciones para evitar registros duplicados por número de
identificación del cliente o número de serie del motor.


**4.3. Gestión de órdenes de reparación**


Cada orden de reparación deberá contener, como mínimo:


  - Número único de orden.

  - Motor asociado.

  - Cliente propietario.

  - Fecha de recepción.

  - Descripción del problema reportado.

  - Diagnóstico técnico.

  - Trabajo realizado o reparación requerida.

  - Técnico responsable, como dato de referencia no es necesario crear usuarios con ese
rol.

  - Fecha estimada de entrega.

  - Fecha real de entrega, cuando aplique.

  - Estado de la reparación.

  - Observaciones.

  - Fecha de creación y última actualización.


Los estados mínimos del proceso serán:


  - Recibido.

  - En diagnóstico.

  - Esperando aprobación.

  - En reparación.

  - En pruebas.

  - Finalizado.

  - Entregado.


La aplicación deberá permitir crear, consultar, listar órdenes de reparación. No se requiere
flujo para editar lo descrito anteriormente.


**4.4. Integración segura entre los servicios**


El frontend deberá autenticarse exclusivamente contra la API de Express.


Una vez autenticado, deberá utilizar el token JWT para consumir los endpoints protegidos de
FastAPI.


FastAPI deberá verificar la firma, expiración y validez del token antes de ejecutar las
operaciones protegidas. No será suficiente con decodificar el contenido del JWT.


Ambos servicios deberán compartir una configuración segura de validación criptográfica, sin
compartir las credenciales de los usuarios ni duplicar la responsabilidad de autenticación.


Se deberá documentar cómo se configuran las claves o secretos utilizados para firmar y
validar los tokens, y cómo se manejan en los diferentes entornos.


**4.5. Interfaz web**


La aplicación React deberá incluir, como mínimo, las siguientes vistas:


1. **Inicio de sesión:** autenticación del usuario.
2. **Dashboard:** resumen de las órdenes de reparación por estado.
3. **Clientes:** listado, creación, edición y consulta de clientes.
4. **Motores:** listado, creación, edición y consulta de motores.
5. **Órdenes de reparación:** listado con búsqueda y filtros por estado, cliente o motor.
6. **Detalle de la orden:** información completa de la reparación, historial y actualización

del estado.
7. **Administración de usuarios:** disponible para el rol administrador, si se implementa

la gestión de usuarios desde la interfaz.


La interfaz deberá contar con formularios validados, indicadores de carga, manejo de errores
de las API y navegación entre las diferentes vistas.


Se valorará que el diseño sea consistente e intuitivo.


### **5. Requerimientos técnicos**

**5.1. Backend de autenticación**


  - Node.js con Express y TypeScript.

  - API REST con respuestas HTTP apropiadas.

  - Validación de entradas.

  - Manejo centralizado de errores.

  - Generación y verificación de JWT.

  - Hash seguro de contraseñas.

  - Configuración mediante variables de entorno.

  - Documentación de endpoints.


**5.2. Backend de negocio**


  - Python con FastAPI.

  - API REST con esquemas de validación.

  - Separación entre rutas, lógica de negocio y acceso a datos.

  - Manejo consistente de errores HTTP.

  - Validación de JWT emitidos por Express.

  - Documentación de endpoints mediante OpenAPI/Swagger.

  - Configuración mediante variables de entorno.


**5.3. Persistencia de datos**


Se deberá utilizar una base de datos relacional bajo PostgreSQL.


Se deberá documentar el modelo de datos y las relaciones entre usuarios, clientes, motores,
órdenes de reparación e historial de estados.


Se podrá utilizar una base de datos independiente por servicio o una estrategia de persistencia
que preserve la separación de responsabilidades. La solución deberá explicar cómo se
garantiza que ambos servicios no dependan de acceder directamente a las tablas internas del
otro.


No se requiere implementar infraestructura distribuida compleja; se espera una solución
sencilla, funcional y coherente con una arquitectura de microservicios.


**5.4. Control de versiones**


Todo el desarrollo deberá realizarse utilizando Git y publicarse en un repositorio de GitHub.


Se espera:


  - Historial de commits claro y descriptivo.

  - Uso de ramas para organizar el desarrollo, por ejemplo, `main` y `feature/*` .

  - Archivo `.gitignore` adecuado para cada tecnología.

  - Exclusión de contraseñas, tokens, claves y otros secretos del repositorio.

  - README con instrucciones para instalar, configurar y ejecutar la solución.


**5.5. Integración y despliegue continuo (CI/CD)**


Implementar un flujo de GitHub Actions que se ejecute ante eventos relevantes del
repositorio, como la creación de un pull request o la actualización de las ramas configuradas.


El flujo deberá contemplar:


  - Ejecución de pruebas automatizadas.

  - Verificación de compilación o validación estática del código.


Como mínimo, el pipeline deberá ejecutar las pruebas y validaciones necesarias para detectar
errores antes de integrar los cambios a la rama principal.


Se valorará implementar la construcción y publicación de imágenes y un despliegue
automatizado a un entorno de pruebas. No es obligatorio desplegar en una infraestructura
cloud real.


### **6. Entregables**

Al finalizar la prueba, el candidato deberá entregar:


1. **Repositorio GitHub:** código fuente completo y organizado.
2. **API Express:** servicio funcional de autenticación y usuarios.
3. **API FastAPI:** servicio funcional de gestión de clientes, motores y reparaciones.
4. **Frontend React:** interfaz funcional integrada con ambos servicios.
5. **Persistencia:** esquema de datos y mecanismos para inicializar la base de datos.
6. **Docker Compose**, preferiblemente, para ejecutar localmente los servicios y sus

dependencias.
7. **Pipeline CI/CD:** archivo o archivos de configuración de GitHub Actions.
8. **README.md:** instrucciones de instalación, configuración, ejecución y pruebas.
9. **Documentación técnica:** diagrama de arquitectura, modelo de datos, endpoints

principales y explicación del mecanismo de autenticación entre servicios.
10. **Evidencia de ejecución:** pruebas automatizadas ejecutadas y pipeline de GitHub

Actions con sus resultados.


El repositorio deberá incluir un archivo `.env.example` con las variables requeridas y valores
de ejemplo no sensibles. No se deberán publicar secretos reales.

### **7. Criterios de evaluación**


La evaluación se centrará en la calidad de la solución y en la capacidad para justificar sus
decisiones técnicas en una sustentación técnica.

|Criterio|Ponderación|
|---|---|
|Diseño de arquitectura y separación de responsabilidades|15 %|
|API Express: autenticación, usuarios y JWT|20 %|
|API FastAPI: lógica de negocio y gestión de reparaciones|20 %|
|Frontend React e integración con las API|15 %|
|Modelado de datos y validaciones|10 %|
|GitHub Actions y automatización CI/CD|10 %|
|Pruebas automatizadas|5 %|
|Documentación, legibilidad y buenas prácticas|5 %|
|**Total**|**100 %**|



No se espera una arquitectura empresarial compleja, sino una solución funcional, segura en
sus aspectos fundamentales, bien estructurada y suficientemente documentada.


### **8. Sustentación**

Al finalizar, se realizará una sustentación técnica de aproximadamente 20, durante la cual
usted deberá:


  - Explicar la arquitectura implementada.

  - Demostrar el inicio de sesión y la validación del JWT en FastAPI.

  - Mostrar el ciclo de vida de una orden de reparación.

  - Explicar las pruebas y el pipeline de GitHub Actions.

  - Justificar las decisiones de seguridad y persistencia.

  - Resolver una modificación menor o una pregunta práctica sobre el código
desarrollado.

### **9. Consideraciones finales**


La prueba busca evaluar la capacidad para construir una solución de software de principio a
fin, comprendiendo cómo interactúan los componentes frontend y backend y cómo se
gestionan la seguridad, los datos y el proceso de entrega del software.


Se priorizarán la claridad del código, la separación de responsabilidades, la correcta
implementación de la autenticación, la consistencia de las reglas de negocio y la capacidad
de explicar y mantener la solución por encima de la cantidad de funcionalidades adicionales

- del uso de tecnologías innecesariamente complejas.


